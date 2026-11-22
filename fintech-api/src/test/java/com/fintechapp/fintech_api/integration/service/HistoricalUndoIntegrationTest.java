package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fintechapp.fintech_api.categorization.infrastructure.HistoricalRuleApplication;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.CategorizationRuleRepository;
import com.fintechapp.fintech_api.repository.RuleApplicationRepository;
import com.fintechapp.fintech_api.service.CategorizationRuleService;
import com.fintechapp.fintech_api.service.TransactionService;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.locks.LockSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class HistoricalUndoIntegrationTest extends BaseIntegrationTest {
  private static final String PATH = "/api/categorization-rules/applications/";
  private static final Instant MONTH_START = Instant.parse("2024-01-01T00:00:00Z");
  private static final String BUDGET_CONFLICT = "The original budget changed; undo is unavailable";
  private static final String FINGERPRINT_CONFLICT =
      "A transaction changed since application; undo would replace newer decisions";

  @Autowired private HistoricalRuleApplication historicalApply;
  @Autowired private CategorizationRuleService rules;
  @Autowired private TransactionService edits;
  @Autowired private RuleApplicationRepository applications;
  @Autowired private CategorizationRuleRepository ruleRepository;
  @Autowired private TransactionTemplate transaction;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private StringRedisTemplate redis;
  private final List<User> owners = new ArrayList<>();

  @AfterEach
  void deleteFixtures() {
    transaction.executeWithoutResult(status -> {
      for (User owner : owners) {
        applications.deleteByUser_Id(owner.getId());
        ruleRepository.deleteByUser_Id(owner.getId());
        transactionRepository.deleteByUser_Id(owner.getId());
        budgetRepository.deleteByUser_Id(owner.getId());
        userRepository.deleteById(owner.getId());
      }
    });
  }

  @ParameterizedTest
  @ValueSource(strings = {"transaction", "missing budget", "renamed budget", "fingerprint"})
  void laterConflictIsDetectedBeforeAnyRestore(String cause) {
    var fixture = fixture();
    String message =
        switch (cause) {
          case "transaction" -> {
            transactionRepository.deleteById(fixture.second());
            yield "A transaction was removed; undo is unavailable";
          }
          case "missing budget" -> {
            budgetRepository.deleteById(fixture.secondBudget());
            yield BUDGET_CONFLICT;
          }
          case "renamed budget" -> {
            jdbc.update(
                "update budgets set category = ? where id = ?", "Renamed", fixture.secondBudget());
            yield BUDGET_CONFLICT;
          }
          default -> {
            jdbc.update(
                "update transactions set amount = amount + 1 where id = ?", fixture.second());
            yield FINGERPRINT_CONFLICT;
          }
        };
    var before = budgetTotals(fixture);
    // A real PostgreSQL constraint makes any premature restoration of the first row fail.
    var conflict =
        assertThrows(
            ResponseStatusException.class,
            () ->
                transaction.executeWithoutResult(status -> {
                  forbidRestoration(fixture.first());
                  undo(fixture);
                }));
    assertEquals(409, conflict.getStatusCode().value());
    assertEquals(message, conflict.getReason());
    assertEquals("Coffee", category(fixture.first()));
    assertEquals(before, budgetTotals(fixture));
    assertNull(journal(fixture).getUndoneAt());
  }

  @Test
  void aFailureFlushingTheSecondRestoreRollsBackTheFirstRestoreAndJournal() {
    var fixture = fixture();
    var before = budgetTotals(fixture);
    String json = journal(fixture).getChangesJson();
    var failure =
        assertThrows(
            DataIntegrityViolationException.class,
            () ->
                transaction.executeWithoutResult(status -> {
                  forbidRestoration(fixture.second());
                  undo(fixture);
                }));
    assertTrue(failure.getMostSpecificCause().getMessage().contains("test_undo_restore_guard"));
    assertEquals("Coffee", category(fixture.first()));
    assertEquals("Coffee", category(fixture.second()));
    assertEquals(before, budgetTotals(fixture));
    assertEquals(json, journal(fixture).getChangesJson());
    assertNull(journal(fixture).getUndoneAt());
  }

  @Test
  void httpPreservesOwnerScopeEmptyJournalAndAlreadyUndoneShortcut() throws Exception {
    User owner = owner("undo-empty");
    User other = owner("undo-other");
    var rule = rule(owner);
    var empty =
        historicalApply.apply(
            actor(owner), rule.id(), rules.preview(actor(owner), rule.id()).token());
    String id = empty.applicationId();
    mockMvc.perform(post(PATH + id + "/undo")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(post(PATH + id + "/undo").header(authHeaderName(), authHeader(other)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Application not found"));
    var first =
        mockMvc
            .perform(post(PATH + id + "/undo").header(authHeaderName(), authHeader(owner)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    assertEquals(
        "{\"success\":true,\"data\":{\"applicationId\":\"" + id + "\",\"changed\":0}}", first);
    var saved = applications.findByIdAndUser_Id(id, owner.getId()).orElseThrow();
    assertNotNull(saved.getUndoneAt());
    assertEquals("{\"changes\":[]}", saved.getChangesJson());
    jdbc.update("update rule_applications set changes_json = ? where id = ?", "unreadable", id);
    mockMvc
        .perform(post(PATH + id + "/undo").header(authHeaderName(), authHeader(owner)))
        .andExpect(status().isOk())
        .andExpect(content().string(first));
    assertEquals(
        saved.getUndoneAt(),
        applications.findByIdAndUser_Id(id, owner.getId()).orElseThrow().getUndoneAt());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void undoCommitsBeforeAWaitingUndoOrEdit(boolean editAfterUndo) throws Exception {
    var fixture = fixture();
    try (var worker = new Worker()) {
      var waiting =
          transaction.execute(status -> {
            assertEquals(2, undo(fixture));
            int holder = jdbc.queryForObject("select pg_backend_pid()", Integer.class);
            var task =
                worker.executor.submit(() -> {
                  if (editAfterUndo) {
                    edit(fixture);
                    return -1;
                  }
                  return undo(fixture);
                });
            awaitBlocked(holder, task);
            return task;
          });
      assertEquals(editAfterUndo ? -1 : 0, waiting.get(10, TimeUnit.SECONDS));
      assertNotNull(journal(fixture).getUndoneAt());
      assertEquals(
          editAfterUndo ? "Newer name" : "Store",
          transactionRepository.findById(fixture.first()).orElseThrow().getName());
    }
  }

  @Test
  void undoWaitsForManualEditAndRejectsItsChangedFingerprint() throws Exception {
    var fixture = fixture();
    try (var worker = new Worker()) {
      var waiting =
          transaction.execute(status -> {
            edit(fixture);
            int holder = jdbc.queryForObject("select pg_backend_pid()", Integer.class);
            var task =
                worker.executor.submit(
                    () -> assertThrows(ResponseStatusException.class, () -> undo(fixture)));
            awaitBlocked(holder, task);
            return task;
          });
      var error = waiting.get(10, TimeUnit.SECONDS);
      assertEquals(409, error.getStatusCode().value());
      assertEquals(FINGERPRINT_CONFLICT, error.getReason());
      assertEquals(
          "Newer name", transactionRepository.findById(fixture.first()).orElseThrow().getName());
      assertEquals("Coffee", category(fixture.second()));
      assertNull(journal(fixture).getUndoneAt());
    }
  }

  @Test
  void redisPreservesRollbackAndNoOpsAndToleratesTimeoutAfterCommit() {
    if (Boolean.getBoolean("test.requireRedis")) assertTrue(redisAvailable());
    else Assumptions.assumeTrue(redisAvailable(), "Requires isolated Redis");
    var fixture = fixture();
    User other = owner("undo-cache-other");
    String summary =
        com.fintechapp.fintech_api.config.CacheConfig.FINANCIAL_SUMMARY_CACHE
            + "::"
            + fixture.owner().getId()
            + ":2024:0";
    String recurring = "recurringPayments::" + fixture.owner().getId();
    String otherRecurring = "recurringPayments::" + other.getId();
    var keys = List.of(summary, recurring);
    keys.forEach(key -> redis.opsForValue().set(key, "cached"));
    redis.opsForValue().set(otherRecurring, "other");
    try {
      transaction.executeWithoutResult(status -> {
        assertEquals(2, undo(fixture));
        keys.forEach(key -> assertEquals("cached", redis.opsForValue().get(key)));
        status.setRollbackOnly();
      });
      keys.forEach(key -> assertEquals("cached", redis.opsForValue().get(key)));
      assertNull(journal(fixture).getUndoneAt());

      assertThrows(
          DataIntegrityViolationException.class,
          () ->
              transaction.executeWithoutResult(status -> {
                forbidRestoration(fixture.second());
                undo(fixture);
              }));
      keys.forEach(key -> assertEquals("cached", redis.opsForValue().get(key)));
      assertNull(journal(fixture).getUndoneAt());
      assertEquals("Coffee", category(fixture.first()));

      assertEquals(2, undo(fixture));
      keys.forEach(key -> assertFalse(redis.hasKey(key)));
      keys.forEach(key -> redis.opsForValue().set(key, "no-op"));
      assertEquals(0, undo(fixture));
      keys.forEach(key -> assertEquals("no-op", redis.opsForValue().get(key)));

      var emptyRule = rule(other);
      var empty =
          historicalApply.apply(
              actor(other), emptyRule.id(), rules.preview(actor(other), emptyRule.id()).token());
      assertEquals(0, historicalApply.undo(actor(other), empty.applicationId()).changed());
      assertEquals("other", redis.opsForValue().get(otherRecurring));

      var rule = rules.list(actor(fixture.owner())).get(0);
      var reapplied =
          historicalApply.apply(
              actor(fixture.owner()),
              rule.id(),
              rules.preview(actor(fixture.owner()), rule.id()).token());
      // Undo restored the unprovenanced category; applying again changes both rows.
      assertEquals(2, reapplied.changed());
      keys.forEach(key -> redis.opsForValue().set(key, "timeout"));
      if (Boolean.getBoolean("test.requireRedis")) {
        try (var connection = redis.getConnectionFactory().getConnection()) {
          connection.execute("CLIENT", ascii("PAUSE"), ascii("2500"), ascii("ALL"));
        }
      }
      assertEquals(
          2, historicalApply.undo(actor(fixture.owner()), reapplied.applicationId()).changed());
      assertNotNull(
          applications
              .findByIdAndUser_Id(reapplied.applicationId(), fixture.owner().getId())
              .orElseThrow()
              .getUndoneAt());
      assertEquals("Uncategorized", category(fixture.first()));
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (!redisAvailable() && System.nanoTime() < deadline)
        LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(100));
      assertTrue(redisAvailable());
      var recovery =
          historicalApply.apply(
              actor(fixture.owner()),
              rule.id(),
              rules.preview(actor(fixture.owner()), rule.id()).token());
      keys.forEach(key -> redis.opsForValue().set(key, "recovery"));
      assertEquals(
          2, historicalApply.undo(actor(fixture.owner()), recovery.applicationId()).changed());
      keys.forEach(key -> assertFalse(redis.hasKey(key)));
      assertEquals("other", redis.opsForValue().get(otherRecurring));
    } finally {
      redis.delete(List.of(summary, recurring, otherRecurring));
    }
  }

  private void awaitBlocked(int holder, Future<?> task) {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (!task.isDone() && System.nanoTime() < deadline) {
      if (Boolean.TRUE.equals(
          jdbc.queryForObject(
              "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
              Boolean.class,
              holder))) return;
      LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(20));
    }
    fail("Expected the competing PostgreSQL session to wait on the owner lock");
  }

  private void forbidRestoration(String id) {
    String fixtureId = UUID.fromString(id).toString();
    jdbc.execute(
        "alter table transactions add constraint test_undo_restore_guard check (id <> '"
            + fixtureId
            + "' or applied_rule_id is not null)");
  }

  private void edit(Fixture fixture) {
    edits.updateTransaction(
        actor(fixture.owner()),
        fixture.first(),
        new UpdateTransactionRequest(
            "Newer name", null, null, null, null, null, null, null, null, null));
  }

  private int undo(Fixture fixture) {
    return historicalApply.undo(actor(fixture.owner()), fixture.applicationId()).changed();
  }

  private com.fintechapp.fintech_api.model.RuleApplication journal(Fixture fixture) {
    return applications
        .findByIdAndUser_Id(fixture.applicationId(), fixture.owner().getId())
        .orElseThrow();
  }

  private String category(String id) {
    return transactionRepository.findById(id).orElseThrow().getCategory();
  }

  private List<Double> budgetTotals(Fixture fixture) {
    return budgetRepository.findByUser_IdOrderByDateDesc(fixture.owner().getId()).stream()
        .map(Budget::getSpent)
        .sorted()
        .toList();
  }

  private Fixture fixture() {
    var owner = owner("undo-fixture");
    var firstBudget = createBudget(owner, "First", 100, MONTH_START);
    var secondBudget = createBudget(owner, "Second", 100, MONTH_START);
    var first =
        createTransaction(
            owner,
            firstBudget,
            "Store",
            MONTH_START.plusSeconds(7200),
            "Old",
            TransactionType.EXPENSE,
            12);
    var second =
        createTransaction(
            owner,
            secondBudget,
            "Store",
            MONTH_START.plusSeconds(3600),
            "Old",
            TransactionType.EXPENSE,
            8);
    var rule = rule(owner);
    var result =
        historicalApply.apply(
            actor(owner), rule.id(), rules.preview(actor(owner), rule.id()).token());
    assertEquals(2, result.changed());
    return new Fixture(
        owner, first.getId(), second.getId(), secondBudget.getId(), result.applicationId());
  }

  private User owner(String prefix) {
    var owner =
        createUser(prefix + "-" + UUID.randomUUID() + "@example.com", "Password123!", prefix);
    owners.add(owner);
    return owner;
  }

  private CategorizationRuleService.RuleView rule(User owner) {
    return rules.save(
        actor(owner),
        null,
        new RuleRequest(
            "Store history",
            "MERCHANT",
            "EXACT",
            "Store",
            null,
            null,
            null,
            "Coffee",
            null,
            null,
            1,
            true,
            null));
  }

  private static AuthenticatedUser actor(User owner) {
    return new AuthenticatedUser(owner.getId(), owner.getEmail(), 0);
  }

  private boolean redisAvailable() {
    try (var connection = redis.getConnectionFactory().getConnection()) {
      return "PONG".equals(connection.ping());
    } catch (RuntimeException unavailable) {
      return false;
    }
  }

  private static byte[] ascii(String value) {
    return value.getBytes(StandardCharsets.US_ASCII);
  }

  private record Fixture(
      User owner, String first, String second, String secondBudget, String applicationId) {}

  private static final class Worker implements AutoCloseable {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void close() {
      executor.shutdownNow();
    }
  }
}
