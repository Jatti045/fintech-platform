package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fintechapp.fintech_api.categorization.infrastructure.HistoricalRuleApplication;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CategorizationConcurrencyIntegrationTest extends BaseIntegrationTest {
  @Autowired HistoricalRuleApplication historicalApply;
  @Autowired PlaidTransactionIngestService ingest;
  @Autowired CategorizationRuleService rules;
  @Autowired TransactionService edits;
  @Autowired CategorizationRuleRepository ruleRepository;
  @Autowired RuleApplicationRepository applications;
  @Autowired PendingClassificationHandoffRepository handoffs;
  @Autowired PlatformTransactionManager manager;

  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

  @Test
  void applyWaitsForOwnerLockBeforeRecomputingHistoryAndRejectsOldToken() throws Exception {
    User owner =
        createUser(
            "apply-lock-" + UUID.randomUUID() + "@example.com", "Password123!", "Apply lock");
    var actor = new AuthenticatedUser(owner.getId(), owner.getEmail(), 0);
    var row =
        createTransaction(
            owner,
            null,
            "Shop",
            Instant.parse("2026-10-01T00:00:00Z"),
            "Old",
            TransactionType.EXPENSE,
            12);
    var rule =
        rules.save(
            actor,
            null,
            new RuleRequest(
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
    String token = rules.preview(actor, rule.id()).token();
    var template = new TransactionTemplate(manager);
    var worker = Executors.newSingleThreadExecutor();
    try {
      var waiter =
          template.execute(status -> {
            userRepository.findByIdForUpdate(owner.getId()).orElseThrow();
            Integer holder = jdbc.queryForObject("select pg_backend_pid()", Integer.class);
            var task =
                worker.submit(() ->
                    assertThrows(
                        org.springframework.web.server.ResponseStatusException.class,
                        () -> historicalApply.apply(actor, rule.id(), token)));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (!Boolean.TRUE.equals(
                    jdbc.queryForObject(
                        "select exists(select 1 from pg_stat_activity where ? ="
                            + " any(pg_blocking_pids(pid)))",
                        Boolean.class,
                        holder))
                && System.nanoTime() < deadline) {
              java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(20));
            }
            assertFalse(task.isDone());
            assertTrue(
                Boolean.TRUE.equals(
                    jdbc.queryForObject(
                        "select exists(select 1 from pg_stat_activity where ? ="
                            + " any(pg_blocking_pids(pid)))",
                        Boolean.class,
                        holder)));
            jdbc.update("update transactions set amount = ? where id = ?", 20, row.getId());
            return task;
          });
      var error = waiter.get(10, TimeUnit.SECONDS);
      assertEquals(409, error.getStatusCode().value());
      assertEquals("History or rules changed. Preview again before applying", error.getReason());
      assertTrue(rules.history(actor).isEmpty());
      var finalRow = transactionRepository.findById(row.getId()).orElseThrow();
      assertEquals("Old", finalRow.getCategory());
      assertEquals(20, finalRow.getAmount());
    } finally {
      worker.shutdownNow();
      template.executeWithoutResult(status -> {
        applications.deleteByUser_Id(owner.getId());
        ruleRepository.deleteByUser_Id(owner.getId());
        transactionRepository.deleteByUser_Id(owner.getId());
        budgetRepository.deleteByUser_Id(owner.getId());
        userRepository.deleteById(owner.getId());
      });
    }
  }

  @Test
  void concurrentProviderWritesAndManualChoiceSerializeAcrossCommittedTransactions()
      throws Exception {
    User u =
        createUser(
            "concurrent-rules-" + UUID.randomUUID() + "@example.com",
            "Password123!",
            "Concurrency");
    AuthenticatedUser auth = new AuthenticatedUser(u.getId(), u.getEmail(), 0);
    var rule =
        rules.save(
            auth,
            null,
            new RuleRequest(
                "Coffee",
                "MERCHANT",
                "NORMALIZED_EXACT",
                "Starbucks",
                null,
                null,
                null,
                "Coffee",
                "Food",
                null,
                1,
                true,
                null));
    Instant date = Instant.parse("2026-10-15T00:00:00Z");
    String plaidId = UUID.randomUUID().toString();
    var initial =
        new PlaidTransaction(
            plaidId,
            "Starbucks",
            date,
            "Food",
            10,
            false,
            "USD",
            null,
            "account",
            "item",
            "FOOD_AND_DRINK_FAST_FOOD",
            false,
            null,
            LocalDate.of(2026, 10, 15));
    ingest.upsertTransaction(u, initial);
    String id =
        transactionRepository
            .findByPlaidTransactionIdAndUser_Id(plaidId, u.getId())
            .orElseThrow()
            .getId();
    ExecutorService pool = Executors.newFixedThreadPool(3);
    CountDownLatch start = new CountDownLatch(1);
    try {
      List<Future<?>> work = new ArrayList<>();
      work.add(
          pool.submit(() -> {
            start.await();
            for (int i = 0; i < 8; i++)
              ingest.upsertTransaction(
                  u,
                  new PlaidTransaction(
                      plaidId,
                      "Starbucks",
                      date,
                      "Food",
                      20,
                      false,
                      "USD",
                      null,
                      "account",
                      "item",
                      "FOOD_AND_DRINK_FAST_FOOD",
                      false,
                      null,
                      LocalDate.of(2026, 10, 15)));
            return null;
          }));
      work.add(
          pool.submit(() -> {
            start.await();
            edits.updateTransaction(
                auth,
                id,
                new UpdateTransactionRequest(
                    "Personal name",
                    null,
                    "Personal category",
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null));
            return null;
          }));
      work.add(
          pool.submit(() -> {
            start.await();
            try {
              historicalApply.apply(auth, rule.id(), rules.preview(auth, rule.id()).token());
            } catch (org.springframework.web.server.ResponseStatusException conflict) {
              assertEquals(409, conflict.getStatusCode().value());
            }
            return null;
          }));
      start.countDown();
      for (Future<?> task : work) task.get(30, TimeUnit.SECONDS);
      var result =
          new TransactionTemplate(manager)
              .execute(status -> {
                Transaction t = transactionRepository.findById(id).orElseThrow();
                assertEquals("Personal name", t.getName());
                assertEquals("Personal Category", t.getCategory());
                assertEquals(20, t.getAmount());
                assertEquals(
                    1, transactionRepository.findByUser_IdOrderByDateDesc(u.getId()).size());
                return budgetRepository.findByUser_IdOrderByDateDesc(u.getId()).stream()
                    .mapToDouble(Budget::getSpent)
                    .sum();
              });
      assertEquals(20, result);
    } finally {
      pool.shutdownNow();
      new TransactionTemplate(manager)
          .executeWithoutResult(status -> {
            applications.deleteByUser_Id(u.getId());
            handoffs.deleteByUser_Id(u.getId());
            ruleRepository.deleteByUser_Id(u.getId());
            transactionRepository.deleteByUser_Id(u.getId());
            budgetRepository.deleteByUser_Id(u.getId());
            userRepository.deleteById(u.getId());
          });
    }
  }
}
