package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@TestPropertySource(properties = "spring.datasource.hikari.maximum-pool-size=3")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StandaloneCurrencyIntegrationTest extends BaseIntegrationTest {
  private static final String CURRENCY = "/api/users/me/currency";
  private static final String SETUP = "/api/users/me/setup";
  private static final String BLOCKED =
      "Cannot change currency after financial data exists (transactions, budgets, or monthly"
          + " income).";

  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate tx;

  @Test
  void wireContractVersionAndExistingCodeAcceptance() throws Exception {
    var owner = owner();
    var other = owner();
    var before = userRepository.findById(owner.getId()).orElseThrow();
    mark("same");
    assertEquals("USD", change(owner, "usd").at("/data/currency").asString());
    assertEquals(
        before.getUpdateVersion(),
        userRepository.findById(owner.getId()).orElseThrow().getUpdateVersion());
    mark("success");
    var response = change(owner, "xyz");
    assertEquals(List.of("success", "message", "data"), List.copyOf(response.propertyNames()));
    assertTrue(response.get("success").asBoolean());
    assertEquals("Currency updated successfully.", response.get("message").asString());
    var data = response.get("data");
    assertEquals(
        List.of(
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
        List.copyOf(data.propertyNames()));
    assertEquals("XYZ", data.get("currency").asString());
    assertEquals(owner.getId(), data.get("id").asString());
    assertEquals(owner.getEmail(), data.get("email").asString());
    assertEquals(owner.getUsername(), data.get("username").asString());
    assertTrue(data.get("profilePic").isNull());
    assertFalse(data.get("setupComplete").asBoolean());
    assertEquals(0, data.get("monthlyIncome").asDouble());
    assertEquals(0, data.get("actualMonthlyIncome").asDouble());
    Instant.parse(data.get("createdAt").asString());
    Instant.parse(data.get("updatedAt").asString());
    var after = userRepository.findById(owner.getId()).orElseThrow();
    assertEquals(before.getUpdateVersion() + 1, after.getUpdateVersion());
    assertEquals(before.getPassword(), after.getPassword());
    assertEquals(before.getSessionVersion(), after.getSessionVersion());
    assertEquals("USD", userRepository.findById(other.getId()).orElseThrow().getCurrency());
  }

  @Test
  void wireValidationAndDeletedSessionBehavior() throws Exception {
    var owner = owner();
    String token = authHeader(owner);
    mockMvc
        .perform(patch(CURRENCY).contentType(json()).content("{\"currency\":\"CAD\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("No token provided."));
    mockMvc
        .perform(
            patch(CURRENCY)
                .header(authHeaderName(), "invalid")
                .contentType(json())
                .content("{\"currency\":\"CAD\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Invalid token format."));
    mockMvc
        .perform(patch(CURRENCY).header(authHeaderName(), token).contentType(json()).content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.currency").value("Currency is required"));
    mockMvc
        .perform(
            patch(CURRENCY)
                .header(authHeaderName(), token)
                .contentType(json())
                .content("{\"currency\":\" CAD \"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Request validation failed."))
        .andExpect(
            jsonPath("$.fieldErrors.currency").value("Currency must be a 3-letter ISO code"));
    userRepository.deleteById(owner.getId());
    mockMvc
        .perform(
            patch(CURRENCY)
                .header(authHeaderName(), token)
                .contentType(json())
                .content("{\"currency\":\"CAD\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Session has been revoked. Please sign in again."));
  }

  @ParameterizedTest
  @ValueSource(strings = {"transactions", "budgets", "income"})
  void financialDataBlocksChangeButAllowsNoOp(String fact) throws Exception {
    var owner = owner();
    Instant month =
        java.time.YearMonth.now(java.time.ZoneOffset.UTC)
            .atDay(1)
            .atStartOfDay()
            .toInstant(java.time.ZoneOffset.UTC);
    switch (fact) {
      case "transactions" ->
          createTransaction(owner, null, "Cash", month, "Income", TransactionType.INCOME, 31);
      case "budgets" -> createBudget(owner, "Food", 50, month);
      case "income" -> createMonthlyIncome(owner, month, 0);
      default -> fail("Unexpected financial fixture");
    }
    mark(fact);
    mockMvc
        .perform(
            patch(CURRENCY)
                .header(authHeaderName(), authHeader(owner))
                .contentType(json())
                .content("{\"currency\":\"CAD\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(BLOCKED));
    var response = change(owner, "usd");
    assertEquals(
        fact.equals("transactions") ? 31 : 0, response.at("/data/actualMonthlyIncome").asDouble());
    assertEquals(0, response.at("/data/monthlyIncome").asDouble());
    assertEquals(
        owner.getUpdateVersion(),
        userRepository.findById(owner.getId()).orElseThrow().getUpdateVersion());
  }

  @ParameterizedTest
  @ValueSource(strings = {"currency-first", "setup-first", "two-currencies"})
  void ownerLockSerializesCompetingSetupAndCurrencyRequests(String scenario) throws Exception {
    var owner = owner();
    boolean setupFirst = scenario.equals("setup-first");
    var acquired = new CountDownLatch(1);
    var release = new CountDownLatch(1);
    var pid = new CompletableFuture<Integer>();
    var workers = Executors.newFixedThreadPool(2);
    try {
      var first =
          workers.submit(() ->
              tx.execute(status -> {
                var response = setupFirst ? setup(owner) : change(owner, "CAD");
                acquired.countDown();
                await(release);
                return response;
              }));
      await(acquired);
      var second =
          workers.submit(() ->
              tx.execute(status -> {
                pid.complete(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
                if (setupFirst) {
                  request(owner, CURRENCY, "{\"currency\":\"CAD\"}", 400);
                  status.setRollbackOnly();
                  return null;
                }
                return scenario.equals("two-currencies") ? change(owner, "EUR") : setup(owner);
              }));
      int backend = pid.get(10, TimeUnit.SECONDS);
      boolean blocked = false;
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
      while (!second.isDone() && System.nanoTime() < deadline) {
        blocked =
            Boolean.TRUE.equals(
                jdbc.queryForObject(
                    "select cardinality(pg_blocking_pids(?)) > 0", Boolean.class, backend));
        if (blocked) break;
        Thread.sleep(10);
      }
      assertTrue(blocked, "Competing request must wait for the owner's PostgreSQL lock");
      release.countDown();
      assertEquals(
          setupFirst ? "EUR" : "CAD",
          first.get(10, TimeUnit.SECONDS).at("/data/currency").asString());
      second.get(10, TimeUnit.SECONDS);
      var persisted = userRepository.findById(owner.getId()).orElseThrow();
      assertEquals("EUR", persisted.getCurrency());
      assertEquals(!scenario.equals("two-currencies"), persisted.isSetupComplete());
    } finally {
      release.countDown();
      workers.shutdownNow();
    }
  }

  private User owner() {
    return createUser(
        "currency-parity-" + UUID.randomUUID() + "@example.com", "Password123!", "currency-parity");
  }

  private void mark(String scenario) {
    jdbc.queryForObject("select 'currency-parity:" + scenario + "'", String.class);
  }

  private tools.jackson.databind.JsonNode change(User user, String currency) {
    return request(user, CURRENCY, "{\"currency\":\"" + currency + "\"}", 200);
  }

  private tools.jackson.databind.JsonNode setup(User user) {
    return request(user, SETUP, "{\"currency\":\"EUR\",\"monthlyIncome\":0}", 200);
  }

  private tools.jackson.databind.JsonNode request(
      User user, String path, String jsonBody, int code) {
    try {
      return objectMapper.readTree(
          mockMvc
              .perform(
                  patch(path)
                      .header(authHeaderName(), authHeader(user))
                      .contentType(json())
                      .content(jsonBody))
              .andExpect(status().is(code))
              .andReturn()
              .getResponse()
              .getContentAsString());
    } catch (Exception error) {
      throw new AssertionError(error);
    }
  }

  private static void await(CountDownLatch latch) {
    try {
      assertTrue(latch.await(10, TimeUnit.SECONDS));
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new AssertionError(exception);
    }
  }
}
