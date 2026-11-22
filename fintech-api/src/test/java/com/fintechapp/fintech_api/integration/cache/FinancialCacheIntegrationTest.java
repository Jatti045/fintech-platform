package com.fintechapp.fintech_api.integration.cache;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fintechapp.fintech_api.config.CacheConfig;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.service.FinancialReportService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Verifies the Redis-backed server-side cache end to end against a real local Redis (docker compose
 * service {@code cache}) and the real PostgreSQL test database.
 *
 * <p>These tests are skipped when Redis is unreachable so ordinary test runs never require Redis —
 * the application falls back to PostgreSQL in that case (covered by {@code
 * FinancialCacheRedisUnavailableIntegrationTest}).
 *
 * <p>Cache-hit evidence: the underlying {@code TransactionRepository} sum aggregation (the
 * summary's database work) is counted via a spy.
 */
// Cache invalidation occurs after commit. Requests must exercise real service
// commits, rather than sharing the test's rollback-only transaction.
@org.springframework.transaction.annotation.Transactional(
    propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
class FinancialCacheIntegrationTest extends BaseIntegrationTest {

  @Autowired private StringRedisTemplate redisTemplate;

  @MockitoSpyBean private TransactionRepository spyTransactionRepository;

  @Autowired private TransactionTemplate transactionTemplate;
  @MockitoSpyBean private FinancialReportService reports;

  private LocalDate utcToday;

  @BeforeEach
  void requireRedisAndCleanCache() {
    utcToday = LocalDate.now(ZoneOffset.UTC);
    if (Boolean.getBoolean("test.requireRedis")) {
      Assertions.assertTrue(redisAvailable(), "Required isolated Redis is unavailable");
    }
    Assumptions.assumeTrue(redisAvailable(), "Redis not reachable — cache tests skipped");
    redisTemplate.delete(redisTemplate.keys(CacheConfig.FINANCIAL_SUMMARY_CACHE + "::*"));
    redisTemplate.delete(redisTemplate.keys("recurringPayments::*"));
  }

  private boolean redisAvailable() {
    try {
      try (var connection = redisTemplate.getConnectionFactory().getConnection()) {
        connection.ping();
      }
      return true;
    } catch (RuntimeException ex) {
      return false;
    }
  }

  private int currentMonthIndex() {
    return utcToday.getMonthValue() - 1;
  }

  private int currentYear() {
    return utcToday.getYear();
  }

  private Instant monthStart(LocalDate month) {
    return month.withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
  }

  // ── Miss → hit → mutation invalidation ──────────────────────────────────

  @Test
  void financialSummary_missThenHit_thenInvalidatedByTransactionCreation() throws Exception {
    User user = createUser("cache-summary@example.com", "Password123!", "cache-summary");
    Instant monthStart = monthStart(utcToday);
    Budget food = createBudget(user, "Food", 500, monthStart);
    createTransaction(
        user,
        food,
        "Groceries",
        monthStart.plusSeconds(3600),
        "Food",
        TransactionType.EXPENSE,
        100.0);
    createMonthlyIncome(user, monthStart, 4000.0);

    // Miss: the authoritative report runs and populate Redis.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.totalAmount").value(100.0));
    verify(reports, times(1))
        .report(
            any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt());

    // Hit: identical request served from Redis — no additional database sums.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(100.0));
    verify(reports, times(1))
        .report(
            any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt());

    // Mutation through the API evicts the cached month aggregate.
    String payload =
        asJson(
            new CreateTransactionPayload(
                "Dinner", utcToday.toString(), "Food", "EXPENSE", 50.0, food.getId()));
    mockMvc
        .perform(
            post("/api/transactions")
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content(payload))
        .andExpect(status().isCreated());

    // Next read recomputes from PostgreSQL and reflects the new transaction.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(150.0));
    verify(reports, times(2))
        .report(
            any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt());
  }

  // ── Month isolation (0-based month API convention) ──────────────────────

  @Test
  void financialSummary_monthIsolation_neverLeaksAcrossMonths() throws Exception {
    User user = createUser("cache-months@example.com", "Password123!", "cache-months");
    LocalDate thisMonth = utcToday.withDayOfMonth(1);
    LocalDate previousMonth = thisMonth.minusMonths(1);

    Budget foodThis = createBudget(user, "Food", 500, monthStart(thisMonth));
    createTransaction(
        user,
        foodThis,
        "Snacks",
        monthStart(thisMonth).plusSeconds(3600),
        "Food",
        TransactionType.EXPENSE,
        120.0);
    Budget foodPrev = createBudget(user, "Food", 500, monthStart(previousMonth));
    createTransaction(
        user,
        foodPrev,
        "Snacks",
        monthStart(previousMonth).plusSeconds(3600),
        "Food",
        TransactionType.EXPENSE,
        300.0);

    // month=8 means September (0-based, 0 = January); the previous month
    // must never answer for it and vice versa.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(thisMonth.getMonthValue() - 1))
                .param("year", String.valueOf(thisMonth.getYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(120.0));

    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(previousMonth.getMonthValue() - 1))
                .param("year", String.valueOf(previousMonth.getYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(300.0));

    // The current month is still served from its own cache entry.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(thisMonth.getMonthValue() - 1))
                .param("year", String.valueOf(thisMonth.getYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(120.0));

    // Two distinct user-scoped month keys exist in Redis.
    Set<String> keys =
        redisTemplate.keys(CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + user.getId() + ":*");
    Assertions.assertEquals(2, keys == null ? 0 : keys.size());
  }

  // ── User isolation ──────────────────────────────────────────────────────

  @Test
  void financialSummary_userIsolation_neverLeaksAcrossUsers() throws Exception {
    User userA = createUser("cache-user-a@example.com", "Password123!", "cache-user-a");
    User userB = createUser("cache-user-b@example.com", "Password123!", "cache-user-b");
    Instant monthStart = monthStart(utcToday);
    Budget foodA = createBudget(userA, "Food", 500, monthStart);
    createTransaction(
        userA,
        foodA,
        "A's expense",
        monthStart.plusSeconds(3600),
        "Food",
        TransactionType.EXPENSE,
        100.0);
    Budget foodB = createBudget(userB, "Food", 500, monthStart);
    createTransaction(
        userB,
        foodB,
        "B's expense",
        monthStart.plusSeconds(3600),
        "Food",
        TransactionType.EXPENSE,
        250.0);

    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(userA))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(100.0));

    // User B must see only B's data, even after A populated the cache.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(userB))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(250.0));

    // User A's cached entry is untouched by B's request.
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(userA))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalAmount").value(100.0));

    Set<String> keysA =
        redisTemplate.keys(CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + userA.getId() + ":*");
    Set<String> keysB =
        redisTemplate.keys(CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + userB.getId() + ":*");
    Assertions.assertEquals(1, keysA == null ? 0 : keysA.size());
    Assertions.assertEquals(1, keysB == null ? 0 : keysB.size());
  }

  // ── Income baseline change invalidates the user's whole summary region ──

  @Test
  void monthlyIncomeUpdate_invalidatesCachedSummaryRegion() throws Exception {
    User user = createUser("cache-income@example.com", "Password123!", "cache-income");
    Instant monthStart = monthStart(utcToday);
    Budget food = createBudget(user, "Food", 500, monthStart);
    createTransaction(
        user,
        food,
        "Groceries",
        monthStart.plusSeconds(3600),
        "Food",
        TransactionType.EXPENSE,
        100.0);
    createMonthlyIncome(user, monthStart, 3000.0);

    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.expectedIncome").value(3000.0));

    mockMvc
        .perform(
            patch("/api/users/me/monthly-income")
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content(
                    asJson(
                        new UpdateMonthlyIncomePayload(
                            4200.0, currentMonthIndex(), currentYear()))))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.expectedIncome").value(4200.0));
  }

  @Test
  void rejectedNonfiniteUpdatePreservesCommittedBaselineAndSummaryKeys() throws Exception {
    var owner = createUser("cache-nonfinite@example.com", "Password123!", "nonfinite");
    var january = Instant.parse("2024-01-01T00:00:00Z");
    createMonthlyIncome(owner, january, 275.125);
    var saved =
        userMonthlyIncomeRepository
            .findByUser_IdAndMonthStart(owner.getId(), january)
            .orElseThrow();
    String prefix = CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + owner.getId();
    var keys = java.util.List.of(prefix + ":2024:0", prefix + ":2024:1");
    keys.forEach(key -> redisTemplate.opsForValue().set(key, "baseline before rejection"));

    var expectedMessages =
        java.util.Map.of(
            "1e1000", "Monthly income must be finite.",
            "-1e1000", "Request validation failed.",
            "\"NaN\"", "Request validation failed.",
            "\"Infinity\"", "Monthly income must be finite.",
            "\"-Infinity\"", "Request validation failed.",
            "NaN", "Invalid request payload.");
    for (var input : expectedMessages.entrySet()) {
      mockMvc
          .perform(
              patch("/api/users/me/monthly-income")
                  .header(authHeaderName(), authHeader(owner))
                  .contentType(json())
                  .content("{\"month\":0,\"year\":2024,\"monthlyIncome\":" + input.getKey() + "}"))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.success").value(false))
          .andExpect(jsonPath("$.message").value(input.getValue()));
    }
    var current =
        userMonthlyIncomeRepository
            .findByUser_IdAndMonthStart(owner.getId(), january)
            .orElseThrow();
    Assertions.assertEquals(saved.getId(), current.getId());
    Assertions.assertEquals(275.125, current.getIncome());
    Assertions.assertEquals(saved.getUpdatedAt(), current.getUpdatedAt());
    keys.forEach(key ->
        Assertions.assertEquals("baseline before rejection", redisTemplate.opsForValue().get(key)));

    mockMvc
        .perform(
            get("/api/financial-summary/report")
                .header(authHeaderName(), authHeader(owner))
                .param("month", "1")
                .param("year", "2024"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.summary.expectedIncome").value(275.13));
  }

  @Test
  void incomeUpdateEvictsEveryOwnerSummaryOnlyAfterCommitAndToleratesRedisTimeout()
      throws Exception {
    var owner = createUser("cache-income-commit@example.com", "Password123!", "income-commit");
    var other = createUser("cache-income-other@example.com", "Password123!", "income-other");
    String keyPrefix = CacheConfig.FINANCIAL_SUMMARY_CACHE + "::";
    var ownerKeys =
        java.util.List.of(
            keyPrefix + owner.getId() + ":2024:0", keyPrefix + owner.getId() + ":2024:11");
    var preserved =
        java.util.List.of(
            keyPrefix + other.getId() + ":2024:0", "recurringPayments::" + owner.getId());
    var allKeys = java.util.stream.Stream.concat(ownerKeys.stream(), preserved.stream()).toList();
    allKeys.forEach(key -> redisTemplate.opsForValue().set(key, "income eviction fixture"));

    var request =
        patch("/api/users/me/monthly-income")
            .header(authHeaderName(), authHeader(owner))
            .contentType(json())
            .content("{\"monthlyIncome\":275,\"month\":0,\"year\":2024}");
    transactionTemplate.executeWithoutResult(status -> {
      try {
        mockMvc.perform(request).andExpect(status().isOk());
      } catch (Exception exception) {
        throw new AssertionError(exception);
      }
      allKeys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
      status.setRollbackOnly();
    });
    allKeys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
    Assertions.assertFalse(userMonthlyIncomeRepository.existsByUser_Id(owner.getId()));

    if (Boolean.getBoolean("test.requireRedis")) {
      try (var connection = redisTemplate.getConnectionFactory().getConnection()) {
        connection.execute(
            "CLIENT",
            "PAUSE".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "2500".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "ALL".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      }
      mockMvc.perform(request).andExpect(status().isOk());
      Assertions.assertEquals(
          275,
          userMonthlyIncomeRepository
              .findByUser_IdAndMonthStart(owner.getId(), Instant.parse("2024-01-01T00:00:00Z"))
              .orElseThrow()
              .getIncome());
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (!redisAvailable() && System.nanoTime() < deadline) Thread.sleep(100);
      Assertions.assertTrue(redisAvailable());
      ownerKeys.forEach(key -> redisTemplate.opsForValue().set(key, "recovery fixture"));
    }

    mockMvc.perform(request).andExpect(status().isOk());
    ownerKeys.forEach(key -> Assertions.assertFalse(redisTemplate.hasKey(key)));
    preserved.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
  }

  @Test
  void setupEvictsOnlyOnCommitAndDoesNotEvictOnRetry() throws Exception {
    var user = createUser("cache-setup@example.com", "Password123!", "cache-setup");
    var other = createUser("cache-setup-other@example.com", "Password123!", "cache-setup-other");
    String summary =
        CacheConfig.FINANCIAL_SUMMARY_CACHE
            + "::"
            + user.getId()
            + ":"
            + currentYear()
            + ":"
            + currentMonthIndex();
    String recurring = "recurringPayments::" + user.getId();
    String otherSummary =
        CacheConfig.FINANCIAL_SUMMARY_CACHE
            + "::"
            + other.getId()
            + ":"
            + currentYear()
            + ":"
            + currentMonthIndex();
    String otherRecurring = "recurringPayments::" + other.getId();
    var keys = java.util.List.of(summary, recurring, otherSummary, otherRecurring);
    keys.forEach(key -> redisTemplate.opsForValue().set(key, "setup eviction fixture"));
    var request =
        patch("/api/users/me/setup")
            .header(authHeaderName(), authHeader(user))
            .contentType(json())
            .content("{\"monthlyIncome\":1800,\"currency\":\"CAD\"}");
    transactionTemplate.executeWithoutResult(status -> {
      try {
        mockMvc.perform(request).andExpect(status().isOk());
      } catch (Exception exception) {
        throw new AssertionError(exception);
      }
      keys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
      status.setRollbackOnly();
    });
    keys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
    var unchanged = userRepository.findById(user.getId()).orElseThrow();
    Assertions.assertFalse(unchanged.isSetupComplete());
    Assertions.assertEquals("USD", unchanged.getCurrency());
    Assertions.assertFalse(userMonthlyIncomeRepository.existsByUser_Id(user.getId()));

    if (Boolean.getBoolean("test.requireRedis")) {
      try (var connection = redisTemplate.getConnectionFactory().getConnection()) {
        connection.execute(
            "CLIENT",
            "PAUSE".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "2500".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "ALL".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      }
      var outage =
          createUser("cache-setup-outage@example.com", "Password123!", "cache-setup-outage");
      mockMvc
          .perform(
              patch("/api/users/me/setup")
                  .header(authHeaderName(), authHeader(outage))
                  .contentType(json())
                  .content("{\"monthlyIncome\":40,\"currency\":\"CAD\"}"))
          .andExpect(status().isOk());
      Assertions.assertTrue(
          userRepository.findById(outage.getId()).orElseThrow().isSetupComplete());
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (!redisAvailable() && System.nanoTime() < deadline) Thread.sleep(100);
      Assertions.assertTrue(redisAvailable());
    }

    mockMvc.perform(request).andExpect(status().isOk());
    Assertions.assertFalse(redisTemplate.hasKey(summary));
    Assertions.assertFalse(redisTemplate.hasKey(recurring));
    Assertions.assertTrue(redisTemplate.hasKey(otherSummary));
    Assertions.assertTrue(redisTemplate.hasKey(otherRecurring));
    redisTemplate.opsForValue().set(summary, "retry fixture");
    redisTemplate.opsForValue().set(recurring, "retry fixture");
    mockMvc.perform(request).andExpect(status().isOk());
    Assertions.assertTrue(redisTemplate.hasKey(summary));
    Assertions.assertTrue(redisTemplate.hasKey(recurring));
  }

  // ── Recurring payments: expensive read is cached and evicted ────────────

  @Test
  void recurringPayments_missThenHit_thenInvalidatedByTransactionCreation() throws Exception {
    User user = createUser("cache-recurring@example.com", "Password123!", "cache-recurring");
    // Four monthly "Rent" occurrences, most recent one month ago.
    for (int i = 1; i <= 4; i++) {
      createTransaction(
          user,
          null,
          "Rent",
          utcToday.withDayOfMonth(1).minusMonths(i).atStartOfDay().toInstant(ZoneOffset.UTC),
          "RENT",
          TransactionType.EXPENSE,
          1450.00);
    }

    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)))
        .andExpect(jsonPath("$.data.recurringPayments[0].name").value("Rent"));
    verify(spyTransactionRepository, times(1))
        .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());

    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)));
    verify(spyTransactionRepository, times(1))
        .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());

    String key = "recurringPayments::" + user.getId();
    String cached = redisTemplate.opsForValue().get(key);
    Assertions.assertNotNull(cached);
    Assertions.assertTrue(cached.contains("RecurringPaymentsResponse$Data"));
    Assertions.assertTrue(cached.contains("RecurringPaymentsResponse$Item"));
    Assertions.assertTrue(cached.contains("java.util.ArrayList"));
    long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
    Assertions.assertTrue(ttl > 840 && ttl <= 900, "Unexpected recurring TTL: " + ttl);

    User other = createUser("cache-recurring-other@example.com", "Password123!", "other");
    String otherKey = "recurringPayments::" + other.getId();
    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(other)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(0)));
    Assertions.assertNotNull(redisTemplate.opsForValue().get(otherKey));

    // This month's Rent posts through the API → cache must be evicted.
    Budget rent = createBudget(user, "RENT", 0, monthStart(utcToday));
    String payload =
        asJson(
            new CreateTransactionPayload(
                "Rent", utcToday.toString(), "RENT", "EXPENSE", 1450.00, rent.getId()));
    transactionTemplate.executeWithoutResult(tx -> {
      Assertions.assertDoesNotThrow(() ->
          mockMvc
              .perform(
                  post("/api/transactions")
                      .header(authHeaderName(), authHeader(user))
                      .contentType(json())
                      .content(payload))
              .andExpect(status().isCreated()));
      Assertions.assertEquals(cached, redisTemplate.opsForValue().get(key));
      tx.setRollbackOnly();
    });
    Assertions.assertEquals(cached, redisTemplate.opsForValue().get(key));

    mockMvc
        .perform(
            post("/api/transactions")
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content(payload))
        .andExpect(status().isCreated());

    Assertions.assertFalse(redisTemplate.hasKey(key));
    Assertions.assertTrue(redisTemplate.hasKey(otherKey));

    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)))
        .andExpect(jsonPath("$.data.recurringPayments[0].occurrences").value(5));
    verify(spyTransactionRepository, times(3))
        .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());
  }

  @Test
  void recurringReadFallsBackDuringRedisTimeoutAndCachesAfterRecovery() throws Exception {
    User user = createUser("cache-recurring-recovery@example.com", "Password123!", "recovery");
    String key = "recurringPayments::" + user.getId();
    var request = get("/api/recurring-payments").header(authHeaderName(), authHeader(user));
    // CLIENT PAUSE affects the whole server. Exercise it only when a dedicated server is required.
    if (Boolean.getBoolean("test.requireRedis")) {
      try (var connection = redisTemplate.getConnectionFactory().getConnection()) {
        connection.execute(
            "CLIENT",
            "PAUSE".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "5000".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "ALL".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      }
      mockMvc
          .perform(request)
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.data.recurringPayments", hasSize(0)));
      verify(spyTransactionRepository, times(1))
          .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (!redisAvailable() && System.nanoTime() < deadline) {
        Thread.sleep(100);
      }
      Assertions.assertTrue(redisAvailable(), "Redis did not recover");
      // A timed-out PUT may still reach Redis after the pause. Force a fresh miss.
      redisTemplate.delete(key);
    }
    mockMvc
        .perform(request)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(0)));
    Assertions.assertNotNull(redisTemplate.opsForValue().get(key));
    mockMvc.perform(request).andExpect(status().isOk());
    verify(spyTransactionRepository, times(Boolean.getBoolean("test.requireRedis") ? 2 : 1))
        .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());
  }

  @Test
  void currencyUpdate_invalidatesCachedSummaryRegionAndRecurringPayments() throws Exception {
    User user =
        createUser("cache-currency-evict@example.com", "Password123!", "cache-currency-evict");
    // A currency change is permitted only before the account has financial data.

    // Populate financialSummary cache
    mockMvc
        .perform(
            get("/api/financial-summary")
                .header(authHeaderName(), authHeader(user))
                .param("month", String.valueOf(currentMonthIndex()))
                .param("year", String.valueOf(currentYear())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.expectedIncome").value(0.0));

    // Populate recurringPayments cache
    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk());

    Set<String> summaryKeys =
        redisTemplate.keys(CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + user.getId() + ":*");
    Set<String> recurringKeys = redisTemplate.keys("recurringPayments::" + user.getId());
    Assertions.assertEquals(1, summaryKeys == null ? 0 : summaryKeys.size());
    Assertions.assertEquals(1, recurringKeys == null ? 0 : recurringKeys.size());

    // Update currency
    mockMvc
        .perform(
            patch("/api/users/me/currency")
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content(asJson(Map.of("currency", "eur"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currency").value("EUR"));

    // Verify Redis caches are evicted
    Set<String> summaryKeysAfter =
        redisTemplate.keys(CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + user.getId() + ":*");
    Set<String> recurringKeysAfter = redisTemplate.keys("recurringPayments::" + user.getId());
    Assertions.assertEquals(0, summaryKeysAfter == null ? 0 : summaryKeysAfter.size());
    Assertions.assertEquals(0, recurringKeysAfter == null ? 0 : recurringKeysAfter.size());
  }

  @Test
  void currencyRollbackNoOpAndBlockedChangesPreserveKeysAndRecoveryEvictsOwnerOnly()
      throws Exception {
    var owner = createUser("cache-currency-scope@example.com", "Password123!", "currency-scope");
    var other = createUser("cache-currency-other@example.com", "Password123!", "currency-other");
    String prefix = CacheConfig.FINANCIAL_SUMMARY_CACHE + "::";
    var keys =
        java.util.List.of(
            prefix + owner.getId() + ":2024:0", "recurringPayments::" + owner.getId());
    String otherKey = prefix + other.getId() + ":2024:0";
    redisTemplate.opsForValue().set(otherKey, "other");
    keys.forEach(key -> redisTemplate.opsForValue().set(key, "owner"));
    var request =
        patch("/api/users/me/currency")
            .header(authHeaderName(), authHeader(owner))
            .contentType(json())
            .content("{\"currency\":\"CAD\"}");
    mockMvc
        .perform(
            patch("/api/users/me/currency")
                .header(authHeaderName(), authHeader(owner))
                .contentType(json())
                .content("{\"currency\":\"USD\"}"))
        .andExpect(status().isOk());
    keys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
    transactionTemplate.executeWithoutResult(status -> {
      try {
        mockMvc.perform(request).andExpect(status().isOk());
      } catch (Exception exception) {
        throw new AssertionError(exception);
      }
      keys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));
      status.setRollbackOnly();
    });
    Assertions.assertEquals(
        "USD", userRepository.findById(owner.getId()).orElseThrow().getCurrency());
    keys.forEach(key -> Assertions.assertTrue(redisTemplate.hasKey(key)));

    if (Boolean.getBoolean("test.requireRedis")) {
      try (var connection = redisTemplate.getConnectionFactory().getConnection()) {
        connection.execute(
            "CLIENT",
            "PAUSE".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "2500".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
            "ALL".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      }
      mockMvc.perform(request).andExpect(status().isOk());
      Assertions.assertEquals(
          "CAD", userRepository.findById(owner.getId()).orElseThrow().getCurrency());
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (!redisAvailable() && System.nanoTime() < deadline) Thread.sleep(100);
      Assertions.assertTrue(redisAvailable());
      keys.forEach(key -> redisTemplate.opsForValue().set(key, "recovery"));
    }

    mockMvc
        .perform(
            patch("/api/users/me/currency")
                .header(authHeaderName(), authHeader(owner))
                .contentType(json())
                .content("{\"currency\":\"EUR\"}"))
        .andExpect(status().isOk());
    keys.forEach(key -> Assertions.assertFalse(redisTemplate.hasKey(key)));
    Assertions.assertEquals("other", redisTemplate.opsForValue().get(otherKey));
    createMonthlyIncome(owner, Instant.parse("2024-01-01T00:00:00Z"), 0);
    keys.forEach(key -> redisTemplate.opsForValue().set(key, "blocked"));
    mockMvc.perform(request).andExpect(status().isBadRequest());
    keys.forEach(key -> Assertions.assertEquals("blocked", redisTemplate.opsForValue().get(key)));
  }

  @Autowired
  private com.fintechapp.fintech_api.service.CategorizationRuleService categorizationRules;

  @Test
  void historicalClassificationRollsBackStateAndDefersOwnerEvictionUntilCommit() {
    var user = createUser("cache-rule-commit@example.com", "Password123!", "cache-rule");
    var other = createUser("cache-rule-other@example.com", "Password123!", "cache-rule-other");
    var tx =
        createTransaction(
            user, null, "Shop", monthStart(utcToday), "Old", TransactionType.EXPENSE, 12);
    var actor =
        new com.fintechapp.fintech_api.dto.auth.AuthenticatedUser(user.getId(), user.getEmail(), 0);
    var rule =
        categorizationRules.save(
            actor,
            null,
            new com.fintechapp.fintech_api.dto.rules.RuleRequest(
                "Shop rule",
                "MERCHANT",
                "EXACT",
                "Shop",
                null,
                null,
                null,
                "Coffee",
                null,
                null,
                1,
                true,
                null));
    String summary =
        CacheConfig.FINANCIAL_SUMMARY_CACHE
            + "::"
            + user.getId()
            + ":"
            + currentYear()
            + ":"
            + currentMonthIndex();
    String recurring = "recurringPayments::" + user.getId();
    String otherRecurring = "recurringPayments::" + other.getId();
    for (String key : java.util.List.of(summary, recurring, otherRecurring)) {
      redisTemplate.opsForValue().set(key, "before historical classification");
    }
    String token = categorizationRules.preview(actor, rule.id()).token();
    transactionTemplate.executeWithoutResult(status -> {
      Assertions.assertEquals(1, categorizationRules.apply(actor, rule.id(), token).changed());
      Assertions.assertTrue(redisTemplate.hasKey(summary));
      Assertions.assertTrue(redisTemplate.hasKey(recurring));
      status.setRollbackOnly();
    });
    Assertions.assertEquals(
        "Old", transactionRepository.findById(tx.getId()).orElseThrow().getCategory());
    Assertions.assertTrue(budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).isEmpty());
    Assertions.assertTrue(categorizationRules.history(actor).isEmpty());
    Assertions.assertTrue(redisTemplate.hasKey(summary));
    Assertions.assertTrue(redisTemplate.hasKey(recurring));

    Assertions.assertEquals(1, categorizationRules.apply(actor, rule.id(), token).changed());
    Assertions.assertEquals(
        "Coffee", transactionRepository.findById(tx.getId()).orElseThrow().getCategory());
    var budget = budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).get(0);
    Assertions.assertEquals(12, budget.getSpent());
    Assertions.assertFalse(redisTemplate.hasKey(summary));
    Assertions.assertFalse(redisTemplate.hasKey(recurring));
    Assertions.assertTrue(redisTemplate.hasKey(otherRecurring));
  }

  // ── Test-only payload shapes (match the API records) ────────────────────

  record CreateTransactionPayload(
      String name, String date, String category, String type, double amount, String budgetId) {}

  record UpdateMonthlyIncomePayload(double monthlyIncome, Integer month, Integer year) {}
}
