package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@org.springframework.test.context.TestPropertySource(
    properties = "spring.datasource.hikari.maximum-pool-size=3")
class AccountSetupIntegrationTest extends BaseIntegrationTest {

  private static final String PASSWORD = "Password123!";
  private static final String SETUP_PATH = "/api/users/me/setup";

  @MockitoBean private GoogleIdTokenVerifier googleVerifier;
  @Autowired private JdbcTemplate jdbc;

  private String committedAccountEmail;

  @AfterEach
  void removeCommittedAccount() throws Exception {
    if (committedAccountEmail == null) return;
    var account = userRepository.findByEmail(committedAccountEmail);
    if (account.isPresent()) {
      var user = account.get();
      mockMvc
          .perform(
              delete("/api/users/{userId}", user.getId())
                  .header(authHeaderName(), authHeader(user)))
          .andExpect(status().isOk());
    }
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void emailSignupRequiresSetupAcrossSessionsAndSavesCadIncomeExactlyOnce() throws Exception {
    String email = "setup-email@example.com";
    committedAccountEmail = email;
    mockMvc
        .perform(
            post("/api/auth/register")
                .contentType(json())
                .content(
                    asJson(
                        Map.of(
                            "username",
                            "New user",
                            "email",
                            email,
                            "password",
                            PASSWORD,
                            "confirmPassword",
                            PASSWORD))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.setupComplete").value(false));

    login(email, false);
    String secondSession = login(email, false);
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), secondSession)
                .contentType(json())
                .content("{\"monthlyIncome\":3500.75,\"currency\":\"CAD\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.monthlyIncome").value(3500.75))
        .andExpect(jsonPath("$.data.currency").value("CAD"));

    String anotherDevice = login(email, true);
    // Replaying a request cannot overwrite the winning setup or create a second baseline.
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), anotherDevice)
                .contentType(json())
                .content("{\"monthlyIncome\":42,\"currency\":\"GBP\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.monthlyIncome").value(3500.75))
        .andExpect(jsonPath("$.data.currency").value("CAD"));

    var currentMonth = LocalDate.now(ZoneOffset.UTC);
    mockMvc
        .perform(
            get("/api/users/me/monthly-income")
                .header(authHeaderName(), anotherDevice)
                .param("year", String.valueOf(currentMonth.getYear()))
                .param("month", String.valueOf(currentMonth.getMonthValue() - 1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.monthlyIncome").value(3500.75))
        .andExpect(jsonPath("$.data.currency").value("CAD"));

    String userId = userRepository.findByEmail(email).orElseThrow().getId();
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_monthly_incomes WHERE user_id = ?", Integer.class, userId));

    mockMvc
        .perform(
            post("/api/transactions")
                .header(authHeaderName(), anotherDevice)
                .contentType(json())
                .content(
                    asJson(
                        Map.of(
                            "name",
                            "Pay",
                            "month",
                            currentMonth.getMonthValue() - 1,
                            "year",
                            currentMonth.getYear(),
                            "date",
                            currentMonth + "T12:00:00Z",
                            "category",
                            "Income",
                            "type",
                            "INCOME",
                            "amount",
                            10))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.transaction.baseCurrency").value("CAD"))
        .andExpect(jsonPath("$.data.transaction.originalCurrency").value("CAD"));
  }

  @Test
  void firstGoogleSignInRequiresSetupAndAcceptsExplicitZero() throws Exception {
    var token = mock(GoogleIdToken.class);
    var payload = new GoogleIdToken.Payload().setEmail("setup-google@example.com");
    payload.set("name", "Google User");
    when(token.getPayload()).thenReturn(payload);
    when(googleVerifier.verify("mock-google-token")).thenReturn(token);
    String header = googleLogin(false);

    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), header)
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"EUR\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.monthlyIncome").value(0))
        .andExpect(jsonPath("$.data.currency").value("EUR"));

    mockMvc
        .perform(get("/api/auth/me").header(authHeaderName(), googleLogin(true)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.currency").value("EUR"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":-1,\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":\"bad\",\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":1e1000,\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":42,\"currency\":\"XYZ\"}"
      })
  void invalidSetupLeavesBothSettingsUnchanged(String body) throws Exception {
    var user = createUser("invalid-setup@example.com", PASSWORD, "Invalid setup");
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content(body))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(get("/api/auth/me").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(false))
        .andExpect(jsonPath("$.data.monthlyIncome").value(0))
        .andExpect(jsonPath("$.data.currency").value("USD"));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_monthly_incomes WHERE user_id = ?",
            Integer.class,
            user.getId()));
  }

  @Test
  void grandfatheredAccountKeepsExistingSettings() throws Exception {
    var user = createUser("existing-setup@example.com", PASSWORD, "Existing");
    user.setSetupComplete(true);
    user.setCurrency("GBP");
    var monthStart =
        LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    createMonthlyIncome(user, monthStart, 1200);

    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), login(user.getEmail(), true))
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"USD\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.monthlyIncome").value(1200))
        .andExpect(jsonPath("$.data.currency").value("GBP"));
  }

  @Test
  void setupRequiresAuthentication() throws Exception {
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"CAD\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void competingSessionsWaitForTheOwnerLockAndKeepTheFirstSettings() throws Exception {
    var user = createUser("setup-race@example.com", PASSWORD, "Setup race");
    committedAccountEmail = user.getEmail();
    String firstToken = login(user.getEmail(), false);
    String secondToken = login(user.getEmail(), false);
    var firstWrote = new CountDownLatch(1);
    var release = new CountDownLatch(1);
    var secondStarted = new CountDownLatch(1);
    var secondPid = new AtomicInteger();
    var pool = Executors.newFixedThreadPool(2);
    try {
      var first =
          pool.submit(() ->
              tx.execute(status -> {
                var response =
                    setup(firstToken, "{\"monthlyIncome\":3500.75,\"currency\":\"cad\"}");
                firstWrote.countDown();
                try {
                  assertTrue(release.await(10, TimeUnit.SECONDS));
                } catch (InterruptedException exception) {
                  Thread.currentThread().interrupt();
                  throw new AssertionError(exception);
                }
                return response;
              }));
      assertTrue(firstWrote.await(10, TimeUnit.SECONDS));
      var second =
          pool.submit(() ->
              tx.execute(status -> {
                secondPid.set(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
                secondStarted.countDown();
                return setup(secondToken, "{\"monthlyIncome\":25,\"currency\":\"GBP\"}");
              }));
      assertTrue(secondStarted.await(10, TimeUnit.SECONDS));
      boolean blocked = false;
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
      while (!second.isDone() && System.nanoTime() < deadline) {
        blocked =
            Boolean.TRUE.equals(
                jdbc.queryForObject(
                    "select cardinality(pg_blocking_pids(?)) > 0", Boolean.class, secondPid.get()));
        if (blocked) break;
        Thread.sleep(10);
      }
      assertTrue(blocked, "The second setup must wait for the owner's PostgreSQL row lock");
      release.countDown();
      for (var response :
          java.util.List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))) {
        assertEquals("Account setup is complete.", response.get("message").asString());
        assertEquals("CAD", response.at("/data/currency").asString());
        assertEquals(3500.75, response.at("/data/monthlyIncome").asDouble());
        assertTrue(response.at("/data/setupComplete").asBoolean());
        assertEquals(user.getId(), response.at("/data/id").asString());
        assertEquals(user.getEmail(), response.at("/data/email").asString());
        assertEquals(user.getUsername(), response.at("/data/username").asString());
        assertTrue(response.at("/data/profilePic").isNull());
        assertEquals(0, response.at("/data/actualMonthlyIncome").asDouble());
        java.time.Instant.parse(response.at("/data/createdAt").asString());
        java.time.Instant.parse(response.at("/data/updatedAt").asString());
        assertEquals(
            java.util.List.of("success", "message", "data"),
            java.util.List.copyOf(response.propertyNames()));
        assertEquals(
            java.util.List.of(
                "id",
                "username",
                "email",
                "profilePic",
                "currency",
                "setupComplete",
                "monthlyIncome",
                "actualMonthlyIncome",
                "createdAt",
                "updatedAt"),
            java.util.List.copyOf(response.get("data").propertyNames()));
      }
      assertTrue(userRepository.findById(user.getId()).orElseThrow().isSetupComplete());
      assertEquals(
          1,
          jdbc.queryForObject(
              "select count(*) from user_monthly_incomes where user_id = ?",
              Integer.class,
              user.getId()));
    } finally {
      release.countDown();
      pool.shutdownNow();
    }
  }

  @Test
  void matchingCurrencyAllowsSetupDespiteFinancialData() throws Exception {
    var user = createUser("setup-same-currency@example.com", PASSWORD, "Same currency");
    var month =
        LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    createBudget(user, "Food", 50, month);
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"CAD\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(
            jsonPath("$.message")
                .value(
                    "Cannot change currency after financial data exists (transactions, budgets, or"
                        + " monthly income)."));
    var result = setup(authHeader(user), "{\"monthlyIncome\":0,\"currency\":\"usd\"}");
    assertTrue(result.at("/data/setupComplete").asBoolean());
    assertEquals("USD", result.at("/data/currency").asString());
    assertEquals(0, result.at("/data/monthlyIncome").asDouble());
  }

  @Test
  void malformedRetryStillFailsHttpValidationBeforeTheCompletedCheck() throws Exception {
    var user = createUser("setup-retry-invalid@example.com", PASSWORD, "Setup retry");
    String token = authHeader(user);
    setup(token, "{\"monthlyIncome\":0,\"currency\":\"USD\"}");
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), token)
                .contentType(json())
                .content("{\"monthlyIncome\":-1,\"currency\":\"USD\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Request validation failed."))
        .andExpect(
            jsonPath("$.fieldErrors.monthlyIncome").value("Monthly income cannot be negative"));
    var result = setup(token, "{\"monthlyIncome\":12,\"currency\":\"XYZ\"}");
    assertEquals(0, result.at("/data/monthlyIncome").asDouble());
    assertEquals("USD", result.at("/data/currency").asString());
  }

  @Test
  void invalidAndDeletedUserTokensAreRejected() throws Exception {
    var user = createUser("setup-deleted@example.com", PASSWORD, "Setup deleted");
    String token = authHeader(user);
    userRepository.delete(user);
    userRepository.flush();
    String body = "{\"monthlyIncome\":0,\"currency\":\"CAD\"}";
    mockMvc
        .perform(
            patch(SETUP_PATH).header(authHeaderName(), "invalid").contentType(json()).content(body))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Invalid token format."));
    mockMvc
        .perform(
            patch(SETUP_PATH).header(authHeaderName(), token).contentType(json()).content(body))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Session has been revoked. Please sign in again."));
  }

  @Autowired private TransactionTemplate tx;

  private tools.jackson.databind.JsonNode setup(String token, String body) {
    try {
      return objectMapper.readTree(
          mockMvc
              .perform(
                  patch(SETUP_PATH)
                      .header(authHeaderName(), token)
                      .contentType(json())
                      .content(body))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString());
    } catch (Exception exception) {
      throw new AssertionError(exception);
    }
  }

  private String login(String email, boolean completed) throws Exception {
    var response =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .contentType(json())
                    .content(asJson(Map.of("email", email, "password", PASSWORD))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.setupComplete").value(completed))
            .andReturn()
            .getResponse();
    return "Bearer "
        + objectMapper.readTree(response.getContentAsString()).at("/data/token").asString();
  }

  private String googleLogin(boolean completed) throws Exception {
    var response =
        mockMvc
            .perform(
                post("/api/auth/google")
                    .contentType(json())
                    .content("{\"idToken\":\"mock-google-token\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.setupComplete").value(completed))
            .andReturn()
            .getResponse();
    return "Bearer "
        + objectMapper.readTree(response.getContentAsString()).at("/data/token").asString();
  }
}
