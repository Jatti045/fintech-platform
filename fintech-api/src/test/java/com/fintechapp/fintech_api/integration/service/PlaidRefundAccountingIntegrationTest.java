package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;
import org.springframework.web.server.ResponseStatusException;

class PlaidRefundAccountingIntegrationTest extends BaseIntegrationTest {
    private static final Instant DATE = Instant.parse("2026-10-15T12:00:00Z");
    @Autowired private PlaidTransactionIngestService ingest;
    @Autowired private InternalTransferReconciliationService reconciliation;
    @Autowired private IncomeCalculationService income;
    @Autowired private TransactionService transactionService;
    @Autowired private EntityManager em;
    @Autowired private DataSource dataSource;

    private User user() {
        User user = createUser("refund-" + UUID.randomUUID() + "@example.com", "Password123!", "RefundTest");
        createMonthlyIncome(user, Instant.parse("2026-10-01T00:00:00Z"), 1000);
        em.flush();
        return user;
    }

    private PlaidTransaction tx(String id, double amount) {
        return new PlaidTransaction(id, "Merchant", DATE, "Food", amount, false, "USD", null,
                "card", "item", "FOOD_AND_DRINK_FAST_FOOD", false, null, LocalDate.of(2026, 10, 15),
                amount < 0 ? "refund" : "purchase");
    }

    private void apply(User user, PlaidTransaction... transactions) {
        reconciliation.lockUser(user.getId());
        ingest.upsertAddedBatch(user, List.of(transactions));
        reconciliation.reconcile(user.getId());
        em.flush();
        em.clear();
    }

    private void net(User user, double expected) {
        var summary = new FinancialSummaryService(income, transactionRepository, userRepository).resolveForMonth(user, 2026, 9);
        assertEquals(expected, summary.totalAmount());
        assertEquals(0, summary.actualIncome(), "Expense credits must never be earned income");
        assertEquals(1000, summary.monthlyIncome(), "Refunds must not replace the expected-income baseline");
        assertEquals(1000 - expected, summary.netRemaining());
        assertEquals(expected / 10, summary.spentPercentageOfIncome());
        assertEquals(expected, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).stream().mapToDouble(Budget::getSpent).sum());
        assertEquals(expected, transactionRepository.sumAmountByUserAndTypeGroupedByCategory(user.getId(),
                TransactionType.EXPENSE, Instant.parse("2026-10-01T00:00:00Z"), Instant.parse("2026-11-01T00:00:00Z"))
                .stream().mapToDouble(t -> t.getTotal()).sum());
    }

    @ParameterizedTest @ValueSource(doubles = {100, 40})
    void fullAndPartialRefundReduceSpendingWithoutIncreasingIncome(double refund) {
        User user = user();
        apply(user, tx("purchase", 100), tx("refund", -refund));
        net(user, 100 - refund);
        Transaction credit = transactionRepository.findByPlaidTransactionIdAndUser_Id("refund", user.getId()).orElseThrow();
        assertEquals(TransactionType.EXPENSE, credit.getType());
        assertEquals(-refund, credit.getAmount());
        assertEquals(refund, credit.getOriginalAmount());
        assertNotNull(credit.getBudget());
        assertFalse(credit.isTransfer());
        // Re-delivery is idempotent.
        apply(user, tx("purchase", 100), tx("refund", -refund));
        net(user, 100 - refund);
        assertEquals(2, transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
    }

    @Test
    void refundModificationsAndRemovalRestoreCorrectSpending() {
        User user = user();
        apply(user, tx("purchase", 100), tx("refund", -40));
        net(user, 60);
        apply(user, tx("refund", -25));
        net(user, 75);
        apply(user, tx("refund", -100));
        net(user, 0);
        ingest.removeByPlaidIds(List.of("refund"), user.getId());
        reconciliation.reconcile(user.getId()); em.flush(); em.clear();
        net(user, 100);
        ingest.removeByPlaidIds(List.of("refund"), user.getId());
        net(user, 100);
    }

    @Test
    void creditsBeforePurchasesAndPurchaseRemovalKeepSignedAggregates() {
        User user = user();
        apply(user, tx("refund", -40));
        net(user, -40);
        apply(user, tx("purchase", 100));
        net(user, 60);
        ingest.removeByPlaidIds(List.of("purchase"), user.getId()); em.flush(); em.clear();
        net(user, -40);
        ingest.removeByPlaidIds(List.of("refund"), user.getId()); em.flush(); em.clear();
        net(user, 0);
    }

    @Test
    void pendingRefundIsReplacedByPostedCreditExactlyOnce() {
        User user = user();
        apply(user, tx("purchase", 100),
                new PlaidTransaction("pending", "Merchant refund", DATE, "Food", -40, false, "USD", null,
                        "card", "item", "FOOD_AND_DRINK_FAST_FOOD", true, null, LocalDate.of(2026, 10, 15)));
        apply(user, new PlaidTransaction("posted", "Merchant refund", DATE, "Food", -40, false, "USD", null,
                "card", "item", "FOOD_AND_DRINK_FAST_FOOD", false, "pending", LocalDate.of(2026, 10, 15)));
        net(user, 60);
        assertTrue(transactionRepository.findByPlaidTransactionIdAndUser_Id("pending", user.getId()).isEmpty());
        assertEquals(2, transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
    }

    @Test
    void payrollAndDepositsRemainIncomeEvenWithMisleadingNames() {
        User user = user();
        apply(user, tx("purchase", 100), tx("refund", -40),
                new PlaidTransaction("payroll", "Refund Company Payroll", DATE, "Income", -500, false, "USD", null,
                        "checking", "item", "INCOME_WAGES"),
                new PlaidTransaction("deposit", "Deposit", DATE, "Transfer", -300, false, "USD", null,
                        "checking", "item", "TRANSFER_IN_DEPOSIT"));
        assertEquals(800, income.resolveActualForMonth(user, 2026, 9));
        assertEquals(60, transactionRepository.sumAmountByUserAndTypeAndDateBetween(user.getId(), TransactionType.EXPENSE,
                Instant.parse("2026-10-01T00:00:00Z"), Instant.parse("2026-11-01T00:00:00Z")));
    }

    @Test
    void manualRefundEditsPreserveCreditDirectionAndDeletionRestoresPurchase() {
        User user = user();
        apply(user, tx("purchase", 100), tx("refund", -40));
        String id = transactionRepository.findByPlaidTransactionIdAndUser_Id("refund", user.getId()).orElseThrow().getId();
        var auth = new AuthenticatedUser(user.getId(), user.getEmail(), 0L);
        transactionService.updateTransaction(auth, id,
                new UpdateTransactionRequest("Renamed", null, null, null, null, null, null, null, null, null));
        em.flush(); em.clear(); net(user, 60);
        transactionService.updateTransaction(auth, id,
                new UpdateTransactionRequest(null, null, null, null, 25.0, null, null, "USD", null, null));
        em.flush(); em.clear(); net(user, 75);
        assertThrows(ResponseStatusException.class, () -> transactionService.updateTransaction(auth, id,
                new UpdateTransactionRequest(null, null, null, "INCOME", null, null, null, null, null, null)));
        net(user, 75);
        transactionService.deleteTransaction(auth, id);
        em.flush(); em.clear(); net(user, 100);
    }

    @Test
    void refundModificationKeepsConfirmedCreditWhenOptionalMetadataIsMissing() {
        User user = user();
        apply(user, tx("purchase", 100), tx("refund", -40));
        apply(user, new PlaidTransaction("refund", "Merchant", DATE, "Food", -25, false,
                "USD", null, "card", "item", null));
        net(user, 75);
    }

    @Test
    void refundCurrencyNormalizationPreservesTheCreditSign() {
        User user = user(); user.setCurrency("CAD"); userRepository.saveAndFlush(user);
        org.mockito.Mockito.when(currencyConversionService.convert(40, "USD", "CAD")).thenReturn(54.0);
        apply(user, new PlaidTransaction("purchase", "Merchant", DATE, "Food", 100, false,
                "CAD", null, "card", "item", "FOOD_AND_DRINK_FAST_FOOD"), tx("refund", -40));
        net(user, 46);
    }

    @Test
    void movingRefundToAnotherMonthRestoresOldBudgetAndCreditsNewMonth() {
        User user = user(); apply(user, tx("purchase", 100), tx("refund", -40));
        apply(user, new PlaidTransaction("refund", "Merchant refund", Instant.parse("2026-11-15T12:00:00Z"),
                "Food", -40, false, "USD", null, "card", "item", "FOOD_AND_DRINK_FAST_FOOD"));
        var summary = new FinancialSummaryService(income, transactionRepository, userRepository);
        assertEquals(100, summary.resolveForMonth(user, 2026, 9).totalAmount());
        assertEquals(-40, summary.resolveForMonth(user, 2026, 10).totalAmount());
        assertEquals(List.of(-40.0, 100.0), budgetRepository.findByUser_IdOrderByDateDesc(user.getId())
                .stream().map(Budget::getSpent).toList());
    }

    @Test
    void historicalRepairConvertsExplicitRefundsAndPreservesPayroll() {
        User user = user();
        apply(user, tx("purchase", 100));
        Transaction legacy = createTransaction(user, null, "Merchant REFUND", DATE, "Food", TransactionType.INCOME, 40);
        legacy.setPlaidTransactionId("legacy-refund"); legacy.setPlaidPfcDetailed("TRANSFER_IN_REFUND");
        Transaction payroll = createTransaction(user, null, "Refund Company Payroll", DATE, "Income", TransactionType.INCOME, 500);
        payroll.setPlaidTransactionId("legacy-payroll"); payroll.setPlaidPfcDetailed("INCOME_WAGES");
        Transaction nameOnly = createTransaction(user, null, "Merchant REFUND", DATE, "Food", TransactionType.INCOME, 25);
        nameOnly.setPlaidTransactionId("legacy-name-refund");
        Transaction deposit = createTransaction(user, null, "Refund Deposit", DATE, "Transfer", TransactionType.INCOME, 300);
        deposit.setPlaidTransactionId("legacy-deposit"); deposit.setPlaidPfcDetailed("TRANSFER_IN_DEPOSIT");
        Transaction manual = createTransaction(user, null, "Refund company invoice", DATE, "Food", TransactionType.INCOME, 50);
        em.flush();
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V21__repair_explicit_plaid_refunds.sql")).execute(dataSource);
        em.clear();
        Transaction fixed = transactionRepository.findByPlaidTransactionIdAndUser_Id("legacy-refund", user.getId()).orElseThrow();
        assertEquals(TransactionType.EXPENSE, fixed.getType()); assertEquals(-40, fixed.getAmount());
        assertEquals(35, fixed.getBudget().getSpent());
        assertEquals(850, income.resolveActualForMonth(user, 2026, 9));
        var auth = new AuthenticatedUser(user.getId(), user.getEmail(), 0L);
        transactionService.updateTransaction(auth, fixed.getId(),
                new UpdateTransactionRequest("Updated legacy refund", null, null, null, null, null, null, null, null, null));
        em.flush(); em.clear();
        assertEquals(-40, transactionRepository.findById(fixed.getId()).orElseThrow().getAmount());
        assertEquals(50, transactionRepository.findById(manual.getId()).orElseThrow().getAmount());
        em.createNativeQuery("DROP TABLE plaid_refund_repairs").executeUpdate();
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V21__repair_explicit_plaid_refunds.sql")).execute(dataSource);
        em.clear();
        assertEquals(35, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).stream().mapToDouble(Budget::getSpent).sum());
        assertEquals(850, income.resolveActualForMonth(user, 2026, 9));
    }
}
