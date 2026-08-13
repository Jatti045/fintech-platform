package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

@ExtendWith(MockitoExtension.class)
class PlaidTransactionIngestServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private PlaidCategoryFormatter categoryFormatter;

    private PlaidTransactionIngestService service;

    @BeforeEach
    void setUp() {
        service = new PlaidTransactionIngestService(transactionRepository, budgetRepository, categoryFormatter);
        lenient().when(categoryFormatter.toReadableCategory(any())).thenReturn("Food & Drink");
    }

    private User user() {
        User u = new User();
        u.setId("user-1");
        u.setCurrency("CAD");
        return u;
    }

    private PlaidTransaction plaidTx(
            String id, String name, String category, double amount, Instant date,
            String iso, String unofficial) {
        return new PlaidTransaction(id, name, date, category, amount, iso, unofficial);
    }

    private Budget budget(String id, double limit, double spent) {
        Budget b = new Budget();
        b.setId(id);
        b.setLimit(limit);
        b.setSpent(spent);
        return b;
    }

    private Transaction transaction(String plaidId, double amount, TransactionType type, Budget budget) {
        Transaction t = new Transaction();
        t.setPlaidTransactionId(plaidId);
        t.setAmount(amount);
        t.setType(type);
        t.setBudget(budget);
        return t;
    }

    // ── No-op guards ─────────────────────────────────────────────────────────

    @Test
    void upsertTransaction_nullPayload_isNoOp() {
        service.upsertTransaction(user(), null);
        verifyNoInteractions(transactionRepository, budgetRepository);
    }

    @Test
    void upsertTransaction_blankTransactionId_isNoOp() {
        service.upsertTransaction(user(), plaidTx("  ", "Coffee", "Coffee", 5.0, Instant.now(), "USD", null));
        verifyNoInteractions(transactionRepository, budgetRepository);
    }

    @Test
    void removeByPlaidIds_nullList_isNoOp() {
        service.removeByPlaidIds(null, "user-1");
        verifyNoInteractions(transactionRepository, budgetRepository);
    }

    @Test
    void removeByPlaidIds_emptyList_isNoOp() {
        service.removeByPlaidIds(List.of(), "user-1");
        verifyNoInteractions(transactionRepository, budgetRepository);
    }

    // ── New transaction + auto-created category ──────────────────────────────

    @Test
    void upsertTransaction_newExpense_autoCreatesZeroLimitBudgetAndIncrementsSpent() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertTransaction(user(), plaidTx("t1", "Starbucks", "FOOD_AND_DRINK", 12.5, Instant.parse("2026-08-05T10:00:00Z"), "USD", null));

        ArgumentCaptor<Budget> budgetCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository, times(2)).save(budgetCaptor.capture());
        Budget created = budgetCaptor.getAllValues().get(0);
        assertEquals(0.0, created.getLimit());
        assertTrue(created.isAutoCreated());
        assertEquals("Food & Drink", created.getCategory());

        // The created budget's spent is incremented by the expense amount
        // (the second save persists the incremented aggregate).
        assertEquals(12.5, budgetCaptor.getAllValues().get(1).getSpent());

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        assertEquals(TransactionType.EXPENSE, txCaptor.getValue().getType());
        assertEquals(12.5, txCaptor.getValue().getAmount());
    }

    @Test
    void upsertTransaction_newIncome_doesNotIncrementBudgetSpent() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        // Negative amount => INCOME (money in).
        service.upsertTransaction(user(), plaidTx("t2", "Paycheck", "Income", -3000.0, Instant.parse("2026-08-01T08:00:00Z"), "USD", null));

        ArgumentCaptor<Budget> budgetCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).save(budgetCaptor.capture());
        assertEquals(0.0, budgetCaptor.getValue().getSpent());

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        assertEquals(TransactionType.INCOME, txCaptor.getValue().getType());
        assertEquals(3000.0, txCaptor.getValue().getAmount()); // absolute amount stored
    }

    @Test
    void upsertTransaction_newExpense_usesFormattedCategory() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertTransaction(user(), plaidTx("t3", "Sushi", "Travel:Air Travel", 40.0, Instant.now(), "USD", null));

        verify(categoryFormatter).toReadableCategory("Travel:Air Travel");
        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        assertEquals("Food & Drink", txCaptor.getValue().getCategory());
    }

    @Test
    void upsertTransaction_blankName_fallsBackToCategory() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertTransaction(user(), plaidTx("t4", "   ", "Coffee", 3.0, Instant.now(), "USD", null));

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        assertEquals("Food & Drink", txCaptor.getValue().getName());
    }

    @Test
    void upsertTransaction_nullDate_usesEpoch() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertTransaction(user(), plaidTx("t5", "Old", "Misc", 1.0, null, "USD", null));

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        assertEquals(Instant.EPOCH, txCaptor.getValue().getDate());
    }


    // ── Currency resolution ──────────────────────────────────────────────────

    private void assertCurrency(String iso, String unofficial, String userCurrency, String expected) {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        User u = user();
        u.setCurrency(userCurrency);
        service.upsertTransaction(u, plaidTx("c-" + iso + unofficial, "X", "X", 1.0, Instant.now(), iso, unofficial));

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        assertEquals(expected, txCaptor.getValue().getBaseCurrency());
    }

    @Test
    void resolveCurrency_isoCodeWins() {
        assertCurrency("CAD", "USD", "EUR", "CAD");
    }

    @Test
    void resolveCurrency_unofficialUsedWhenIsoBlank() {
        assertCurrency(null, "gbp", "EUR", "GBP");
    }

    @Test
    void resolveCurrency_userCurrencyWhenBothBlank() {
        assertCurrency(null, null, "cad", "CAD");
    }

    @Test
    void resolveCurrency_defaultsToUsdWhenEverythingBlank() {
        assertCurrency(null, null, null, "USD");
    }


    // ── Existing budget matching ─────────────────────────────────────────────

    @Test
    void upsertTransaction_existingBudgetMatch_reusesBudget() {
        Budget existing = budget("b1", 500.0, 100.0);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(existing));

        service.upsertTransaction(user(), plaidTx("t6", "Lunch", "FOOD_AND_DRINK", 20.0, Instant.now(), "USD", null));

        // The existing budget is reused — no new budget is created.
        verify(budgetRepository).save(existing);
        assertEquals(120.0, existing.getSpent()); // spent incremented on the existing row
    }

    @Test
    void upsertTransaction_caseInsensitiveBudgetMatch_reusesBudget() {
        Budget existing = budget("b2", 100.0, 10.0);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(existing));

        service.upsertTransaction(user(), plaidTx("t7", "Dinner", "dinner", 15.0, Instant.now(), "USD", null));

        verify(budgetRepository).save(existing);
        assertEquals(25.0, existing.getSpent());
    }

    // ── Duplicate / modified transaction idempotency ─────────────────────────

    @Test
    void upsertTransaction_duplicatePlaidId_updatesExistingTransaction() {
        Budget budget = budget("b3", 500.0, 30.0);
        Transaction existingTx = transaction("dup-1", 30.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("dup-1", "user-1"))
                .thenReturn(Optional.of(existingTx));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        // Same transaction re-sent with a NEW amount (modified).
        service.upsertTransaction(user(), plaidTx("dup-1", "Lunch", "Food", 35.0, Instant.now(), "USD", null));

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository, times(1)).save(txCaptor.capture());
        assertEquals(35.0, txCaptor.getValue().getAmount());
        // Spent adjusted by the diff (30 -> 35 = +5).
        assertEquals(35.0, budget.getSpent());
    }

    @Test
    void upsertTransaction_modifiedAmountDecrease_adjustsSpentDown() {
        Budget budget = budget("b4", 500.0, 50.0);
        Transaction existingTx = transaction("dup-2", 40.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("dup-2", "user-1"))
                .thenReturn(Optional.of(existingTx));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        service.upsertTransaction(user(), plaidTx("dup-2", "Lunch", "Food", 25.0, Instant.now(), "USD", null));

        assertEquals(35.0, budget.getSpent()); // 50 - (40 - 25)
    }

    @Test
    void upsertTransaction_expenseConvertedToIncome_decrementsBudgetSpent() {
        Budget budget = budget("b5", 500.0, 80.0);
        Transaction existingTx = transaction("dup-3", 80.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("dup-3", "user-1"))
                .thenReturn(Optional.of(existingTx));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        // Now the same transaction is an income (negative) — spent must be restored.
        service.upsertTransaction(user(), plaidTx("dup-3", "Refund", "Food", -80.0, Instant.now(), "USD", null));

        assertEquals(0.0, budget.getSpent());
    }


    // ── Removed transactions ─────────────────────────────────────────────────

    @Test
    void removeByPlaidIds_expenseTransactions_restoresBudgetSpentAndDeletes() {
        Budget budget = budget("b6", 500.0, 90.0);
        Transaction tx = transaction("rem-1", 40.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("rem-1"), "user-1"))
                .thenReturn(List.of(tx));

        service.removeByPlaidIds(List.of("rem-1"), "user-1");

        assertEquals(50.0, budget.getSpent());
        verify(budgetRepository).save(budget);
        verify(transactionRepository).delete(tx);
    }

    @Test
    void removeByPlaidIds_incomeTransaction_doesNotTouchBudget() {
        Budget budget = budget("b7", 500.0, 30.0);
        Transaction tx = transaction("rem-2", 1000.0, TransactionType.INCOME, budget);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("rem-2"), "user-1"))
                .thenReturn(List.of(tx));

        service.removeByPlaidIds(List.of("rem-2"), "user-1");

        assertEquals(30.0, budget.getSpent());
        verify(budgetRepository, never()).save(any(Budget.class));
        verify(transactionRepository).delete(tx);
    }

    @Test
    void removeByPlaidIds_multipleTransactions_deletesAll() {
        Budget b1 = budget("b8", 100.0, 10.0);
        Budget b2 = budget("b9", 100.0, 20.0);
        Transaction t1 = transaction("r1", 10.0, TransactionType.EXPENSE, b1);
        Transaction t2 = transaction("r2", 20.0, TransactionType.EXPENSE, b2);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("r1", "r2"), "user-1"))
                .thenReturn(List.of(t1, t2));

        service.removeByPlaidIds(List.of("r1", "r2"), "user-1");

        assertEquals(0.0, b1.getSpent());
        assertEquals(0.0, b2.getSpent());
        verify(transactionRepository).delete(t1);
        verify(transactionRepository).delete(t2);
    }

    @Test
    void removeByPlaidIds_expenseBudgetSpentFloorsAtZero() {
        Budget budget = budget("b10", 100.0, 5.0);
        Transaction tx = transaction("rem-3", 50.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("rem-3"), "user-1"))
                .thenReturn(List.of(tx));

        service.removeByPlaidIds(List.of("rem-3"), "user-1");

        assertEquals(0.0, budget.getSpent()); // floored at zero
    }
}

