package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/** Real SQL/JPA budgeting, history and financial-summary regression coverage. */
class InternalTransferAccountingIntegrationTest extends BaseIntegrationTest {
    @Autowired PlaidTransactionIngestService ingest;
    @Autowired InternalTransferReconciliationService reconciler;
    @PersistenceContext EntityManager em;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;

    User user() { return createUser(UUID.randomUUID() + "@example.com", "Password123!", "transfer-test"); }
    PlaidTransaction leg(String id, double amount, String account, String item, int day, String detailed) {
        return new PlaidTransaction(id, "Bank transfer", Instant.parse("2026-03-" + String.format("%02d", day) + "T00:00:00Z"),
                amount >= 0 ? "TRANSFER_OUT" : "TRANSFER_IN", amount, false, "USD", null, account, item, detailed,
                false, null, LocalDate.of(2026, 3, day));
    }
    PlaidTransaction out(String id, int day) { return leg(id, 500, "checking", "bank-1", day, "TRANSFER_OUT_ACCOUNT_TRANSFER"); }
    PlaidTransaction in(String id, int day) { return leg(id, -500, "savings", "bank-1", day, "TRANSFER_IN_ACCOUNT_TRANSFER"); }
    void apply(User user, PlaidTransaction... legs) {
        reconciler.lockUser(user.getId());
        ingest.upsertAddedBatch(user, List.of(legs));
        reconciler.reconcile(user.getId());
        em.flush(); em.clear();
    }
    List<Transaction> rows(User user) { return transactionRepository.findByUser_IdOrderByDateDesc(user.getId()); }
    double spent(User user) { return budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).stream().mapToDouble(Budget::getSpent).sum(); }
    double total(User user, TransactionType type) {
        return transactionRepository.sumAmountByUserAndTypeAndDateBetween(user.getId(), type,
                Instant.parse("2026-03-01T00:00:00Z"), Instant.parse("2026-04-01T00:00:00Z"));
    }
    void pairIsExcluded(User user) {
        assertEquals(2, rows(user).size()); assertTrue(rows(user).stream().allMatch(Transaction::isTransfer));
        assertEquals(0, total(user, TransactionType.INCOME)); assertEquals(0, total(user, TransactionType.EXPENSE));
        assertEquals(0, spent(user));
    }

    @Test void normalTransfer_historyAndSummaryEndpoints_preserveBothRows() throws Exception {
        User user = user(); apply(user, out("out", 15), in("in", 15)); pairIsExcluded(user);
        mockMvc.perform(get("/api/transactions").header(authHeaderName(), authHeader(user))
                .param("currentMonth", "2").param("currentYear", "2026"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.transaction.length()").value(2))
                .andExpect(jsonPath("$.data.transaction[?(@.type == 'EXPENSE')].amount").value(org.hamcrest.Matchers.contains(500.0)))
                .andExpect(jsonPath("$.data.transaction[?(@.type == 'INCOME')].amount").value(org.hamcrest.Matchers.contains(500.0)))
                .andExpect(jsonPath("$.data.transaction[*].isTransfer").value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is(true))));
        mockMvc.perform(get("/api/financial-summary").header(authHeaderName(), authHeader(user))
                .param("month", "2").param("year", "2026"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.actualIncome").value(0.0))
                .andExpect(jsonPath("$.data.totalAmount").value(0.0));
    }

    @ParameterizedTest @ValueSource(strings = {"checking", "savings", "another-checking"})
    void accountTypesAndCrossBankSettlement_supported(String destination) {
        User user = user();
        apply(user, leg("out", 500, "source", "bank-1", 15, "TRANSFER_OUT_ACCOUNT_TRANSFER"),
                leg("in", -500, destination, "bank-2", 18, "TRANSFER_IN_ACCOUNT_TRANSFER")); pairIsExcluded(user);
    }

    @Test void sameValuePayrollRentAndRefundRemainNormal_andDoNotBlockTransfer() {
        User user = user();
        apply(user, out("out", 15), in("in", 15),
                leg("payroll", -500, "checking", "bank-1", 15, "INCOME_WAGES"),
                leg("rent", 500, "checking", "bank-1", 15, "RENT_AND_UTILITIES_RENT"),
                leg("refund", -500, "checking", "bank-1", 15, "TRANSFER_IN_REFUND"));
        assertEquals(5, rows(user).size()); assertEquals(2, rows(user).stream().filter(Transaction::isTransfer).count());
        assertEquals(1000, total(user, TransactionType.INCOME)); assertEquals(500, total(user, TransactionType.EXPENSE)); assertEquals(500, spent(user));
    }

    @Test void differentUsers_neverPairInRealRepository() {
        User a = user(), b = user(); apply(a, out("out", 15)); apply(b, in("in", 15));
        assertFalse(rows(a).get(0).isTransfer()); assertFalse(rows(b).get(0).isTransfer());
        assertEquals(500, total(a, TransactionType.EXPENSE)); assertEquals(500, total(b, TransactionType.INCOME));
    }

    @Test void repeatedSyncDoesNotDuplicateOrReadjustBudget() {
        User user = user(); apply(user, out("out", 15), in("in", 16));
        apply(user, out("out", 15), in("in", 16));
        reconciler.reconcile(user.getId()); em.flush(); em.clear(); pairIsExcluded(user);
    }

    @ParameterizedTest @ValueSource(strings = {"out", "in"})
    void removedLeg_restoresRemainingNormalContributionExactlyOnce(String removed) {
        User user = user(); apply(user, out("out", 15), in("in", 15));
        reconciler.lockUser(user.getId()); ingest.removeByPlaidIds(List.of(removed), user.getId());
        reconciler.reconcile(user.getId()); reconciler.reconcile(user.getId()); em.flush(); em.clear();
        assertEquals(1, rows(user).size()); assertFalse(rows(user).get(0).isTransfer());
        assertEquals(removed.equals("in") ? 500 : 0, spent(user));
    }

    @ParameterizedTest @ValueSource(strings = {"amount", "account", "date", "category"})
    void plaidModificationInvalidatesPair_andRestoresExpense(String field) {
        User user = user(); apply(user, out("out", 15), in("in", 15));
        apply(user, leg("in", field.equals("amount") ? -501 : -500,
                field.equals("account") ? "checking" : "savings", "bank-1", field.equals("date") ? 20 : 15,
                field.equals("category") ? "INCOME_WAGES" : "TRANSFER_IN_ACCOUNT_TRANSFER"));
        assertTrue(rows(user).stream().noneMatch(Transaction::isTransfer)); assertEquals(500, spent(user));
        reconciler.reconcile(user.getId()); em.flush(); em.clear(); assertEquals(500, spent(user));
    }

    @Test void manualTransferEditNeedsNoBudget_andInvalidatingEditRestoresBothLegs() throws Exception {
        User user = user(); apply(user, out("out", 15), in("in", 15));
        String id = transactionRepository.findByPlaidTransactionIdAndUser_Id("out", user.getId()).orElseThrow().getId();
        mockMvc.perform(patch("/api/transactions/" + id).header(authHeaderName(), authHeader(user))
                .contentType("application/json").content("{\"name\":\"Renamed transfer\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.transaction.isTransfer").value(true));
        em.flush(); em.clear(); pairIsExcluded(user);
        mockMvc.perform(patch("/api/transactions/" + id).header(authHeaderName(), authHeader(user))
                .contentType("application/json").content("{\"category\":\"Shopping\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.transaction.isTransfer").value(false));
        em.flush(); em.clear(); assertEquals(500, spent(user)); assertTrue(rows(user).stream().noneMatch(Transaction::isTransfer));
    }

    @ParameterizedTest @ValueSource(strings = {"amount", "date"})
    void manualAmountOrDateEditReevaluatesImportedPostingMetadata(String field) throws Exception {
        User user = user(); apply(user, out("out", 15), in("in", 15));
        String id = transactionRepository.findByPlaidTransactionIdAndUser_Id("out", user.getId()).orElseThrow().getId();
        String body = field.equals("amount") ? "{\"amount\":501}" : "{\"date\":\"2026-03-20T00:00:00Z\"}";
        mockMvc.perform(patch("/api/transactions/" + id).header(authHeaderName(), authHeader(user))
                .contentType("application/json").content(body)).andExpect(status().isOk());
        em.flush(); em.clear();
        assertTrue(rows(user).stream().noneMatch(Transaction::isTransfer));
        assertEquals(field.equals("amount") ? 501 : 500, spent(user));
    }

    @Test void manualDeletionReevaluatesSurvivor() throws Exception {
        User user = user(); apply(user, out("out", 15), in("in", 15));
        String id = transactionRepository.findByPlaidTransactionIdAndUser_Id("in", user.getId()).orElseThrow().getId();
        mockMvc.perform(delete("/api/transactions/" + id).header(authHeaderName(), authHeader(user))).andExpect(status().isOk());
        em.flush(); em.clear(); assertFalse(rows(user).get(0).isTransfer()); assertEquals(500, spent(user));
    }

    @Test void pendingReplacement_removedAfterPostedAdd_leavesTwoTransferRows() {
        User user = user(); PlaidTransaction pending = new PlaidTransaction("pending", "Bank movement",
                Instant.parse("2026-03-15T00:00:00Z"), "TRANSFER_IN", -500, false, "USD", null,
                "savings", "bank-1", "TRANSFER_IN_ACCOUNT_TRANSFER", true, null, LocalDate.of(2026, 3, 15));
        apply(user, out("out", 15), pending); assertTrue(rows(user).stream().noneMatch(Transaction::isTransfer));
        PlaidTransaction posted = new PlaidTransaction("posted", "Bank movement",
                Instant.parse("2026-03-16T00:00:00Z"), "TRANSFER_IN", -500, false, "USD", null,
                "savings", "bank-1", "TRANSFER_IN_ACCOUNT_TRANSFER", false, "pending", LocalDate.of(2026, 3, 16));
        reconciler.lockUser(user.getId()); ingest.upsertTransaction(user, posted);
        ingest.removeByPlaidIds(List.of("pending"), user.getId()); reconciler.reconcile(user.getId());
        em.flush(); em.clear(); pairIsExcluded(user);
        apply(user, posted); pairIsExcluded(user);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentPagesForTwoItemsOfSameUser_doNotDoubleAdjustBudget() throws Exception {
        var txTemplate = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        User user = txTemplate.execute(status -> user());
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var outFuture = pool.submit(() -> {
                start.await();
                txTemplate.executeWithoutResult(status -> {
                    reconciler.lockUser(user.getId());
                    ingest.upsertTransaction(user, out("concurrent-out", 15));
                    reconciler.reconcile(user.getId());
                });
                return null;
            });
            var inFuture = pool.submit(() -> {
                start.await();
                txTemplate.executeWithoutResult(status -> {
                    reconciler.lockUser(user.getId());
                    ingest.upsertTransaction(user, leg("concurrent-in", -500, "savings", "bank-2", 16, "TRANSFER_IN_ACCOUNT_TRANSFER"));
                    reconciler.reconcile(user.getId());
                });
                return null;
            });
            start.countDown();
            outFuture.get(15, java.util.concurrent.TimeUnit.SECONDS);
            inFuture.get(15, java.util.concurrent.TimeUnit.SECONDS);
            txTemplate.executeWithoutResult(status -> pairIsExcluded(user));
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(15, java.util.concurrent.TimeUnit.SECONDS);
            txTemplate.executeWithoutResult(status -> {
                transactionRepository.deleteByUser_Id(user.getId());
                budgetRepository.deleteByUser_Id(user.getId());
                userRepository.deleteById(user.getId());
            });
        }
    }

    @ParameterizedTest @ValueSource(strings = {"sync", "manual"})
    void updatingLegacyTransferWithBudgetLink_doesNotLoseTheBudgetRepair(String path) throws Exception {
        User user = user(); reconciler.lockUser(user.getId());
        ingest.upsertAddedBatch(user, List.of(out("out", 15), in("in", 15)));
        Transaction outgoing = transactionRepository.findByPlaidTransactionIdAndUser_Id("out", user.getId()).orElseThrow();
        outgoing.setTransfer(true); transactionRepository.saveAndFlush(outgoing);
        String id = outgoing.getId();
        if (path.equals("sync")) {
            apply(user, out("out", 15));
        } else {
            mockMvc.perform(patch("/api/transactions/" + id).header(authHeaderName(), authHeader(user))
                    .contentType("application/json").content("{\"name\":\"Renamed transfer\"}"))
                    .andExpect(status().isOk());
            em.flush(); em.clear();
        }
        pairIsExcluded(user);
    }

    @Test void existingTransferWithIncorrectBudgetLink_isRepairedAuthoritatively() {
        User user = user(); reconciler.lockUser(user.getId());
        ingest.upsertAddedBatch(user, List.of(out("out", 15), in("in", 15)));
        Transaction outgoing = transactionRepository.findByPlaidTransactionIdAndUser_Id("out", user.getId()).orElseThrow();
        outgoing.setTransfer(true); // reproduces the old manual-update bug: flag true, spent still 500
        transactionRepository.saveAndFlush(outgoing);
        reconciler.reconcile(user.getId()); em.flush(); em.clear(); pairIsExcluded(user);
        assertTrue(rows(user).stream().allMatch(tx -> tx.getBudget() == null));
        reconciler.reconcile(user.getId()); em.flush(); em.clear(); pairIsExcluded(user);
    }

    @Test void historicalReconciliationRebuildsActualBudgetSpending_withoutGuessingIncompleteHistory() {
        User user = user(); reconciler.lockUser(user.getId());
        ingest.upsertAddedBatch(user, List.of(out("out", 15), in("in", 15),
                leg("purchase", 25, "checking", "bank-1", 15, "FOOD_AND_DRINK_COFFEE")));
        em.flush(); em.clear();
        Budget budget = budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).get(0);
        budgetRepository.incrementSpent(budget.getId(), 999); // stale historical aggregate
        reconciler.reconcileHistory(user.getId()); em.flush(); em.clear();
        assertEquals(25, spent(user)); assertEquals(2, rows(user).stream().filter(Transaction::isTransfer).count());
        reconciler.reconcileHistory(user.getId()); em.flush(); em.clear(); assertEquals(25, spent(user));
    }
}
