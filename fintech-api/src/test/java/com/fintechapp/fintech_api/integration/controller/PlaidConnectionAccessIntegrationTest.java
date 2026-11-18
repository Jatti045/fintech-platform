package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.EncryptionService;
import com.fintechapp.fintech_api.service.PlaidRevocationClient;
import com.fintechapp.fintech_api.service.PlaidRevocationJobService;
import com.fintechapp.fintech_api.service.PlaidRevocationWorker;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

@TestPropertySource(
    properties = {"app.plaid.client-id=test-client", "app.plaid.secret=test-secret"})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PlaidConnectionAccessIntegrationTest extends BaseIntegrationTest {
  private static final String OWNER_ID = "aa83bde1-0502-4bf8-8e6b-cf38ae2fa262";
  private static final String PRIVATE_MESSAGE = "Bank linking is currently private.";
  private static final String PRODUCTION = "https://production.plaid.com";
  private static final String SANDBOX = "https://sandbox.plaid.com";

  @MockitoBean(name = "plaidRestClient")
  private RestClient plaidClient;

  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlaidItemRepository items;
  @Autowired private EncryptionService encryption;
  @Autowired private PlaidSettings settings;
  @Autowired private PlaidRevocationJobService revocations;
  @Autowired private PlaidRevocationClient revocationClient;

  // Each nested test uses committed rows because token exchange forbids an ambient transaction.
  abstract class ConnectionScenario {
    private User user;
    private String disconnectedItemId;

    User account(boolean owner) {
      user = createUser("link-" + UUID.randomUUID() + "@example.com", "Password123!", "link-test");
      if (owner) {
        jdbc.update("UPDATE users SET id = ? WHERE id = ?", OWNER_ID, user.getId());
        user = userRepository.findById(OWNER_ID).orElseThrow();
      }
      return user;
    }

    @AfterEach
    void clean() {
      if (disconnectedItemId != null) {
        jdbc.update("DELETE FROM plaid_revocation_jobs WHERE id = ?", disconnectedItemId);
      }
      if (user != null) {
        jdbc.update("DELETE FROM transactions WHERE user_id = ?", user.getId());
        jdbc.update("DELETE FROM plaid_items WHERE user_id = ?", user.getId());
        userRepository.deleteById(user.getId());
      }
    }

    void capability(User account, boolean allowed) throws Exception {
      mockMvc
          .perform(get("/api/plaid/capabilities").header(authHeaderName(), authHeader(account)))
          .andExpect(status().isOk())
          .andExpect(
              content().json("{\"canConnectBank\":" + allowed + "}", JsonCompareMode.STRICT));
    }

    void assertBlocked(User account) throws Exception {
      capability(account, false);
      var header = authHeader(account);
      var responseMessage = MockMvcResultMatchers.jsonPath("$.message").value(PRIVATE_MESSAGE);
      mockMvc
          .perform(post("/api/plaid/link-token").header(authHeaderName(), header))
          .andExpect(status().isForbidden())
          .andExpect(responseMessage);
      mockMvc
          .perform(
              post("/api/plaid/token")
                  .header(authHeaderName(), header)
                  .contentType(json())
                  .content("{\"publicToken\":\"public-denied\"}"))
          .andExpect(status().isForbidden())
          .andExpect(responseMessage);
      verifyNoInteractions(plaidClient);
      assertEquals(
          0,
          jdbc.queryForObject(
              "SELECT COUNT(*) FROM plaid_connection_attempts WHERE user_id = ?",
              Integer.class,
              account.getId()));
    }

    void assertLinkAndExchange(User account, String host) throws Exception {
      capability(account, true);
      var server = mockPlaid(host);
      String itemId = "remote-" + UUID.randomUUID();
      String publicToken = "public-" + UUID.randomUUID();
      server
          .expect(requestTo(host + "/link/token/create"))
          .andExpect(jsonPath("$.user.client_user_id").value(account.getId()))
          .andRespond(withSuccess("{\"link_token\":\"link-test\"}", MediaType.APPLICATION_JSON));
      server
          .expect(requestTo(host + "/item/public_token/exchange"))
          .andExpect(jsonPath("$.public_token").value(publicToken))
          .andRespond(
              withSuccess(
                  asJson(Map.of("item_id", itemId, "access_token", "access-test")),
                  MediaType.APPLICATION_JSON));

      mockMvc
          .perform(post("/api/plaid/link-token").header(authHeaderName(), authHeader(account)))
          .andExpect(status().isOk())
          .andExpect(MockMvcResultMatchers.jsonPath("$.data.linkToken").value("link-test"));
      mockMvc
          .perform(
              post("/api/plaid/token")
                  .header(authHeaderName(), authHeader(account))
                  .contentType(json())
                  .content(asJson(Map.of("publicToken", publicToken))))
          .andExpect(status().isOk())
          .andExpect(MockMvcResultMatchers.jsonPath("$.data.item.itemId").value(itemId));
      server.verify();
    }

    MockRestServiceServer mockPlaid(String expectedHost) {
      assertEquals(expectedHost, settings.baseUrl());
      var builder = RestClient.builder().baseUrl(settings.baseUrl());
      var server = MockRestServiceServer.bindTo(builder).build();
      var mockTransport = builder.build();
      doAnswer(call -> mockTransport.post()).when(plaidClient).post();
      return server;
    }

    void assertExistingItemCanBeManaged(User account) throws Exception {
      var item = new PlaidItem();
      item.setUser(account);
      item.setItemId("remote-existing-" + UUID.randomUUID());
      item.setAccessTokenEncrypted(encryption.encrypt("access-existing"));
      items.saveAndFlush(item);
      disconnectedItemId = item.getId();
      var server = mockPlaid(PRODUCTION);
      server
          .expect(requestTo(PRODUCTION + "/link/token/create"))
          .andExpect(jsonPath("$.access_token").value("access-existing"))
          .andExpect(jsonPath("$.products").doesNotExist())
          .andRespond(withSuccess("{\"link_token\":\"link-update\"}", MediaType.APPLICATION_JSON));
      server
          .expect(requestTo(PRODUCTION + "/item/remove"))
          .andExpect(jsonPath("$.access_token").value("access-existing"))
          .andRespond(withSuccess("{\"request_id\":\"confirmed\"}", MediaType.APPLICATION_JSON));

      User other =
          createUser("foreign-" + UUID.randomUUID() + "@example.com", "Password123!", "foreign");
      try {
        var update =
            post("/api/plaid/link-token/update")
                .contentType(json())
                .content(asJson(Map.of("itemId", item.getId())));
        mockMvc
            .perform(update.header(authHeaderName(), authHeader(other)))
            .andExpect(status().isNotFound());
        mockMvc
            .perform(
                delete("/api/plaid/items/{id}", item.getId())
                    .header(authHeaderName(), authHeader(other)))
            .andExpect(status().isNotFound());

        mockMvc
            .perform(get("/api/plaid/items").header(authHeaderName(), authHeader(account)))
            .andExpect(status().isOk())
            .andExpect(
                MockMvcResultMatchers.jsonPath("$.data.items[0].itemId").value(item.getItemId()));
        mockMvc
            .perform(
                post("/api/plaid/link-token/update")
                    .header(authHeaderName(), authHeader(account))
                    .contentType(json())
                    .content(asJson(Map.of("itemId", item.getId()))))
            .andExpect(status().isOk());
        mockMvc
            .perform(
                post("/api/plaid/items/reauth-complete")
                    .header(authHeaderName(), authHeader(account))
                    .contentType(json())
                    .content(asJson(Map.of("itemId", item.getId()))))
            .andExpect(status().isOk());
        mockMvc
            .perform(
                post("/api/plaid/sync/{id}", item.getId())
                    .header(authHeaderName(), authHeader(account)))
            .andExpect(status().isAccepted());
        mockMvc
            .perform(
                delete("/api/plaid/items/{id}", item.getId())
                    .header(authHeaderName(), authHeader(account)))
            .andExpect(status().isOk());
        new PlaidRevocationWorker(revocations, revocationClient, Runnable::run).processOne();
        server.verify();
        assertEquals(
            0,
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM plaid_revocation_jobs WHERE id = ?",
                Integer.class,
                item.getId()));
      } finally {
        userRepository.deleteById(other.getId());
      }
    }
  }

  @Nested
  @TestPropertySource(
      properties = {"app.plaid.environment=Production", "app.plaid.live-owner-user-id=" + OWNER_ID})
  class Production extends ConnectionScenario {
    @Test
    void ownerCanLink() throws Exception {
      assertLinkAndExchange(account(true), PRODUCTION);
    }

    @Test
    void otherAccountCannotLink() throws Exception {
      assertBlocked(account(false));
    }

    @Test
    void capabilityRequiresAuthentication() throws Exception {
      mockMvc.perform(get("/api/plaid/capabilities")).andExpect(status().isUnauthorized());
    }
  }

  @Nested
  @TestPropertySource(
      properties = {"app.plaid.environment=production", "app.plaid.live-owner-user-id="})
  class UnsetOwner extends ConnectionScenario {
    @Test
    void blocksNewLinks() throws Exception {
      assertBlocked(account(false));
    }

    @Test
    void manualTransactionsStillWork() throws Exception {
      var account = account(false);
      capability(account, false);
      mockMvc
          .perform(
              post("/api/transactions")
                  .header(authHeaderName(), authHeader(account))
                  .contentType(json())
                  .content(
                      asJson(
                          Map.of(
                              "name",
                              "Salary",
                              "month",
                              2,
                              "year",
                              2026,
                              "date",
                              "2026-03-01T08:00:00Z",
                              "category",
                              "Income",
                              "type",
                              "INCOME",
                              "amount",
                              3000,
                              "baseCurrency",
                              "USD"))))
          .andExpect(status().isCreated())
          .andExpect(MockMvcResultMatchers.jsonPath("$.data.transaction.name").value("Salary"));
      verifyNoInteractions(plaidClient);
    }

    @Test
    void existingItemStillSupportsUpdateSyncDisconnectAndRevocation() throws Exception {
      var account = account(false);
      assertBlocked(account);
      assertExistingItemCanBeManaged(account);
    }
  }

  @Nested
  @TestPropertySource(
      properties = {"app.plaid.environment=production", "app.plaid.live-owner-user-id=invalid"})
  class InvalidOwner extends ConnectionScenario {
    @Test
    void blocksNewLinks() throws Exception {
      assertBlocked(account(false));
    }
  }

  @Nested
  @TestPropertySource(
      properties = {"app.plaid.environment=development", "app.plaid.live-owner-user-id="})
  class LegacyDevelopment extends ConnectionScenario {
    @Test
    void blocksNewLinks() throws Exception {
      assertBlocked(account(false));
    }
  }

  @Nested
  @TestPropertySource(
      properties = {"app.plaid.environment=sandbox", "app.plaid.live-owner-user-id="})
  class Sandbox extends ConnectionScenario {
    @Test
    void canLinkWithoutOwner() throws Exception {
      assertLinkAndExchange(account(false), SANDBOX);
    }
  }
}
