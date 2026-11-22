package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@TestPropertySource(properties = "spring.datasource.hikari.maximum-pool-size=3")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class MonthlyIncomeUpdateIntegrationTest extends BaseIntegrationTest {
  private static final String PATH = "/api/users/me/monthly-income";

  @Autowired private TransactionTemplate tx;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void responseAndCarryForwardPreserveOwnerPeriodAndActualIncome() throws Exception {
    var owner = createUser("income-update-contract@example.com", "Password123!", "income-update");
    var other = createUser("income-update-other@example.com", "Password123!", "income-other");
    var february = Instant.parse("2024-02-01T00:00:00Z");
    createMonthlyIncome(other, february, 9000);
    createTransaction(
        owner,
        null,
        "February pay",
        Instant.parse("2024-02-29T23:59:59Z"),
        "Income",
        TransactionType.INCOME,
        17.125);
    createTransaction(
        owner,
        null,
        "March pay",
        Instant.parse("2024-03-01T00:00:00Z"),
        "Income",
        TransactionType.INCOME,
        40);
    createTransaction(other, null, "Other pay", february, "Income", TransactionType.INCOME, 700);

    expected(owner, 11, 2023, 0, 0);
    update(authHeader(owner), 11, 2023, 50);
    update(authHeader(owner), 0, 2024, 100);
    expected(owner, 1, 2024, 100, 17.125);
    var response = update(authHeader(owner), 1, 2024, 200.125);
    assertEquals(List.of("success", "message", "data"), List.copyOf(response.propertyNames()));
    assertTrue(response.get("success").asBoolean());
    assertEquals("Monthly income updated successfully.", response.get("message").asString());
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
    assertEquals(owner.getId(), data.get("id").asString());
    assertEquals(owner.getEmail(), data.get("email").asString());
    assertEquals(owner.getUsername(), data.get("username").asString());
    assertTrue(data.get("profilePic").isNull());
    assertEquals("USD", data.get("currency").asString());
    assertFalse(data.get("setupComplete").asBoolean());
    Instant.parse(data.get("createdAt").asString());
    Instant.parse(data.get("updatedAt").asString());
    assertEquals(200.125, data.get("monthlyIncome").asDouble());
    assertEquals(17.125, data.get("actualMonthlyIncome").asDouble());

    update(authHeader(owner), 0, 2024, 125);
    expected(owner, 1, 2024, 200.125, 17.125);
    update(authHeader(owner), 1, 2024, 0);
    expected(owner, 2, 2024, 0, 40);
    update(authHeader(owner), 5, 2024, 500);
    expected(owner, 4, 2024, 0, 0);
    expected(owner, 6, 2024, 500, 0);
    expected(other, 1, 2024, 9000, 700);
    assertEquals(
        0,
        userMonthlyIncomeRepository
            .findByUser_IdAndMonthStart(owner.getId(), february)
            .orElseThrow()
            .getIncome());
    assertEquals(
        4,
        jdbc.queryForObject(
            "select count(*) from user_monthly_incomes where user_id = ?",
            Integer.class,
            owner.getId()));
  }

  @Test
  void validationAndAuthenticationKeepExistingOrderAndMessages() throws Exception {
    var owner =
        createUser("income-update-error@example.com", "Password123!", "income-update-error");
    String token = authHeader(owner);
    String valid = "{\"monthlyIncome\":0,\"month\":0,\"year\":2024}";
    mockMvc
        .perform(patch(PATH).contentType(json()).content(valid))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("No token provided."));
    mockMvc
        .perform(patch(PATH).header(authHeaderName(), "invalid").contentType(json()).content(valid))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Invalid token format."));
    mockMvc
        .perform(patch(PATH).header(authHeaderName(), token).contentType(json()).content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.monthlyIncome").value("Monthly income is required"));
    mockMvc
        .perform(
            patch(PATH)
                .header(authHeaderName(), token)
                .contentType(json())
                .content("{\"monthlyIncome\":-1}"))
        .andExpect(status().isBadRequest())
        .andExpect(
            jsonPath("$.fieldErrors.monthlyIncome").value("Monthly income cannot be negative"));
    mockMvc
        .perform(
            patch(PATH)
                .header(authHeaderName(), token)
                .contentType(json())
                .content("{\"monthlyIncome\":1e1000,\"month\":0,\"year\":2024}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Monthly income must be finite."));
    mockMvc
        .perform(
            patch(PATH)
                .header(authHeaderName(), token)
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"month\":0}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Month and year are required"));
    for (String body :
        List.of(
            "{\"monthlyIncome\":0,\"month\":12,\"year\":2024}",
            "{\"monthlyIncome\":0,\"month\":0,\"year\":0}")) {
      mockMvc
          .perform(patch(PATH).header(authHeaderName(), token).contentType(json()).content(body))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.message").value("Invalid month/year value"));
    }
    assertFalse(userMonthlyIncomeRepository.existsByUser_Id(owner.getId()));
    var deleted = createUser("income-update-deleted@example.com", "Password123!", "income-deleted");
    String deletedToken = authHeader(deleted);
    userRepository.deleteById(deleted.getId());
    mockMvc
        .perform(
            patch(PATH).header(authHeaderName(), deletedToken).contentType(json()).content(valid))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Session has been revoked. Please sign in again."));
  }

  @Test
  void competingUpdatesWaitAndWriteOneBaselineInCommitOrder() throws Exception {
    var owner = createUser("income-update-race@example.com", "Password123!", "income-update-race");
    String token = authHeader(owner);
    var inserted = new CountDownLatch(1);
    var commit = new CountDownLatch(1);
    var secondPid = new CompletableFuture<Integer>();
    var pool = Executors.newFixedThreadPool(2);
    try {
      var first =
          pool.submit(() ->
              tx.execute(status -> {
                var response = update(token, 1, 2024, 110);
                inserted.countDown();
                await(commit);
                return response;
              }));
      await(inserted);
      var second =
          pool.submit(() ->
              tx.execute(status -> {
                secondPid.complete(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
                return update(token, 1, 2024, 220);
              }));
      int pid = secondPid.get(10, TimeUnit.SECONDS);
      boolean blocked = false;
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
      while (!second.isDone() && System.nanoTime() < deadline) {
        blocked =
            Boolean.TRUE.equals(
                jdbc.queryForObject(
                    "select cardinality(pg_blocking_pids(?)) > 0", Boolean.class, pid));
        if (blocked) break;
        Thread.sleep(10);
      }
      assertTrue(blocked, "Second request must wait for the owner's row lock");
      commit.countDown();
      assertEquals(110, first.get(10, TimeUnit.SECONDS).at("/data/monthlyIncome").asDouble());
      assertEquals(220, second.get(10, TimeUnit.SECONDS).at("/data/monthlyIncome").asDouble());
      expected(owner, 2, 2024, 220, 0);
      assertEquals(
          1,
          jdbc.queryForObject(
              "select count(*) from user_monthly_incomes where user_id = ?",
              Integer.class,
              owner.getId()));
    } finally {
      commit.countDown();
      pool.shutdownNow();
    }
  }

  @Autowired private com.fintechapp.fintech_api.service.MonthlyIncomeService incomeService;

  @Test
  void sharedIncomeWriterRejectsNonfiniteValuesAndRollsBackTheJoinedTransaction() {
    var owner = createUser("nonfinite-direct@example.com", "Password123!", "nonfinite-direct");
    var january = Instant.parse("2024-01-01T00:00:00Z");
    createMonthlyIncome(owner, january, 125.25);
    for (double invalid :
        new double[] {Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NaN}) {
      assertThrows(
          IllegalArgumentException.class,
          () ->
              tx.executeWithoutResult(status -> {
                incomeService.upsertForMonth(owner, 2024, 1, 40);
                incomeService.upsertForMonth(owner, 2024, 0, invalid);
              }));
      assertEquals(
          125.25,
          userMonthlyIncomeRepository
              .findByUser_IdAndMonthStart(owner.getId(), january)
              .orElseThrow()
              .getIncome());
      assertTrue(
          userMonthlyIncomeRepository
              .findByUser_IdAndMonthStart(owner.getId(), Instant.parse("2024-02-01T00:00:00Z"))
              .isEmpty());
    }
  }

  private tools.jackson.databind.JsonNode update(String token, int month, int year, double amount) {
    try {
      return objectMapper.readTree(
          mockMvc
              .perform(
                  patch(PATH)
                      .header(authHeaderName(), token)
                      .contentType(json())
                      .content(
                          asJson(
                              java.util.Map.of(
                                  "month", month, "year", year, "monthlyIncome", amount))))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString());
    } catch (Exception exception) {
      throw new AssertionError(exception);
    }
  }

  private void expected(User owner, int month, int year, double expected, double actual)
      throws Exception {
    mockMvc
        .perform(
            get(PATH)
                .header(authHeaderName(), authHeader(owner))
                .param("month", String.valueOf(month))
                .param("year", String.valueOf(year)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.monthlyIncome").value(expected))
        .andExpect(jsonPath("$.data.actualMonthlyIncome").value(actual));
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
