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
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

@ExtendWith(MockitoExtension.class)
class PlaidTransactionIngestServiceTest {

    // Indexes into the SQL args captured from the native INSERT.
    private static final int IDX_NAME = 1;
    private static final int IDX_DATE = 2;
    private static final int IDX_CATEGORY = 3;
    private static final int IDX_TYPE = 4;
    private static final int IDX_AMOUNT = 5;
    private static final int IDX_BASE_CURRENCY = 6;
    private static final int IDX_PLAID_TX_ID = 9;
    private static final int IDX_PLAID_ITEM_ID = 10;
    private static final int IDX_PENDING_TX_ID = 11;
    private static final int IDX_USER_ID = 12;
    private static final int IDX_BUDGET_ID = 13;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private PlaidCategoryFormatter categoryFormatter;

    @Mock
    private JdbcTemplate jdbcTemplate;

    private PlaidTransactionIngestService service;

    @BeforeEach
    void setUp() {
        service = new PlaidTransactionIngestService(
                transactionRepository, budgetRepository, categoryFormatter, jdbcTemplate);
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
        return plaidTx(id, null, false, name, category, amount, date, iso, unofficial);
    }

    private PlaidTransaction plaidTx(
            String id, String pendingId, String name, String category, double amount, Instant date,
            String iso, String unofficial) {
        return plaidTx(id, pendingId, false, name, category, amount, date, iso, unofficial);
    }

    private PlaidTransaction plaidTx(
            String id, String pendingId, boolean pending, String name, String category, double amount,
            Instant date, String iso, String unofficial) {
        return new PlaidTransaction(id, pendingId, pending, name, date, category, amount, iso, unofficial);
    }

    /** Most tests sync against a single Plaid Item. */
    private void upsert(PlaidTransaction plaidTx) {
        service.upsertTransaction(user(), plaidTx, "item-1");
    }

    /** Stubs the full INSERT path: no existing row, no budget, native insert succeeds. */
    private void stubNewTransactionInsert() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
    }

    private List<Object> capturedInsertArgs() {
        ArgumentCaptor<Object[]> captor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(anyString(), captor.capture());
        Object[] args = captor.getValue();
        return args == null ? List.of() : Arrays.asList(args);
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

    /** An already-persisted row belonging to a (different) Plaid Item. */
    private Transaction existingRow(String id, String plaidId, String itemId, double amount, Instant date) {
        Transaction t = new Transaction();
        t.setId(id);
        t.setPlaidTransactionId(plaidId);
        t.setPlaidItemId(itemId);
        t.setBaseCurrency("USD");
        t.setAmount(amount);
        t.setType(TransactionType.EXPENSE);
        t.setDate(date);
        t.setBudget(budget("b-row-" + id, 500.0, amount));
        return t;
    }

    // ── No-op guards ─────────────────────────────────────────────────────────

    @Test
    void upsertTransaction_nullPayload_isNoOp() {
        service.upsertTransaction(user(), null, "item-1");
        verifyNoInteractions(transactionRepository, budgetRepository, jdbcTemplate);
    }

    @Test
    void upsertTransaction_blankTransactionId_isNoOp() {
        service.upsertTransaction(
                user(), plaidTx("  ", "Coffee", "Coffee", 5.0, Instant.now(), "USD", null), "item-1");
        verifyNoInteractions(transactionRepository, budgetRepository, jdbcTemplate);
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
        stubNewTransactionInsert();

        upsert(plaidTx("t1", "Starbucks", "FOOD_AND_DRINK", 12.5, Instant.parse("2026-08-05T10:00:00Z"), "USD", null));

        ArgumentCaptor<Budget> flushCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).saveAndFlush(flushCaptor.capture());
        Budget created = flushCaptor.getValue();
        assertEquals(0.0, created.getLimit());
        assertTrue(created.isAutoCreated());
        assertEquals("Food & Drink", created.getCategory());

        // The created budget's spent is incremented by the expense amount.
        ArgumentCaptor<Budget> saveCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).save(saveCaptor.capture());
        assertEquals(12.5, saveCaptor.getValue().getSpent());

        List<Object> args = capturedInsertArgs();
        assertEquals(TransactionType.EXPENSE.name(), args.get(IDX_TYPE));
        assertEquals(12.5, (Double) args.get(IDX_AMOUNT));
        assertEquals("t1", args.get(IDX_PLAID_TX_ID));
        assertEquals("item-1", args.get(IDX_PLAID_ITEM_ID));
    }

    @Test
    void upsertTransaction_newIncome_doesNotIncrementBudgetSpent() {
        stubNewTransactionInsert();

        // Negative amount => INCOME (money in).
        upsert(plaidTx("t2", "Paycheck", "Income", -3000.0, Instant.parse("2026-08-01T08:00:00Z"), "USD", null));

        ArgumentCaptor<Budget> budgetCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).saveAndFlush(budgetCaptor.capture());
        assertEquals(0.0, budgetCaptor.getValue().getSpent());

        List<Object> args = capturedInsertArgs();
        assertEquals(TransactionType.INCOME.name(), args.get(IDX_TYPE));
        assertEquals(3000.0, (Double) args.get(IDX_AMOUNT)); // absolute amount stored
    }

    @Test
    void upsertTransaction_newExpense_usesFormattedCategory() {
        stubNewTransactionInsert();

        upsert(plaidTx("t3", "Sushi", "Travel:Air Travel", 40.0, Instant.now(), "USD", null));

        List<Object> args = capturedInsertArgs();
        assertEquals("Food & Drink", args.get(IDX_CATEGORY));
    }

    @Test
    void upsertTransaction_blankName_fallsBackToCategory() {
        stubNewTransactionInsert();

        upsert(plaidTx("t4", "   ", "Coffee", 3.0, Instant.now(), "USD", null));

        List<Object> args = capturedInsertArgs();
        assertEquals("Food & Drink", args.get(IDX_NAME));
    }

    @Test
    void upsertTransaction_nullDate_usesEpoch() {
        stubNewTransactionInsert();

        upsert(plaidTx("t5", "Old", "Misc", 1.0, null, "USD", null));

        List<Object> args = capturedInsertArgs();
        assertEquals(Instant.EPOCH, ((java.sql.Timestamp) args.get(IDX_DATE)).toInstant());
    }


    // ── Currency resolution ──────────────────────────────────────────────────

    private void assertCurrency(String iso, String unofficial, String userCurrency, String expected) {
        stubNewTransactionInsert();

        User u = user();
        u.setCurrency(userCurrency);
        service.upsertTransaction(
                u, plaidTx("c-" + iso + unofficial, "X", "X", 1.0, Instant.now(), iso, unofficial), "item-1");

        List<Object> args = capturedInsertArgs();
        assertEquals(expected, args.get(IDX_BASE_CURRENCY));
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
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        upsert(plaidTx("t6", "Lunch", "FOOD_AND_DRINK", 20.0, Instant.now(), "USD", null));

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
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        upsert(plaidTx("t7", "Dinner", "dinner", 15.0, Instant.now(), "USD", null));

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
        upsert(plaidTx("dup-1", "Lunch", "Food", 35.0, Instant.now(), "USD", null));

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

        upsert(plaidTx("dup-2", "Lunch", "Food", 25.0, Instant.now(), "USD", null));

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
        upsert(plaidTx("dup-3", "Refund", "Food", -80.0, Instant.now(), "USD", null));

        assertEquals(0.0, budget.getSpent());
    }


    // ── Same transaction synced twice ────────────────────────────────────────

    @Test
    void upsertTransaction_sameTransactionTwice_persistsOnce() {
        Budget budget = budget("b11", 500.0, 0.0);
        Transaction stored = transaction("id-A", 5.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("id-A", "user-1"))
                .thenReturn(Optional.empty(), Optional.of(stored)); // first insert, second update
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        upsert(plaidTx("id-A", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null));
        upsert(plaidTx("id-A", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null));

        verify(jdbcTemplate, times(1)).update(anyString(), any(Object[].class)); // one insert
        verify(transactionRepository, times(1)).save(stored);                 // one update
    }

    @Test
    void upsertTransaction_multipleDuplicates_persistsOnceEach() {
        Budget budget = budget("b12", 500.0, 0.0);
        Transaction storedA = transaction("A", 5.0, TransactionType.EXPENSE, budget);
        Transaction storedB = transaction("B", 18.0, TransactionType.EXPENSE, budget);
        Transaction storedC = transaction("C", 12.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(
                        Optional.empty(), Optional.empty(), Optional.empty(),
                        Optional.of(storedA), Optional.of(storedB), Optional.of(storedC));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        upsert(plaidTx("A", "STARBUCKS", "Food", 5.0, date, "USD", null));
        upsert(plaidTx("B", "UBER", "Food", 18.0, date, "USD", null));
        upsert(plaidTx("C", "CVS", "Food", 12.0, date, "USD", null));
        // Second pass: each transaction is now recognized by its id and updated.
        upsert(plaidTx("A", "STARBUCKS", "Food", 5.0, date, "USD", null));
        upsert(plaidTx("B", "UBER", "Food", 18.0, date, "USD", null));
        upsert(plaidTx("C", "CVS", "Food", 12.0, date, "USD", null));

        // Exactly three inserts (one per logical transaction) and three updates.
        verify(jdbcTemplate, times(3)).update(anyString(), any(Object[].class));
        verify(transactionRepository, times(3)).save(any(Transaction.class));
    }


    // ── Identical values, different ids ──────────────────────────────────────

    @Test
    void upsertTransaction_identicalValuesDifferentIds_sameItem_remainDistinct() {
        stubNewTransactionInsert();
        Transaction sameItemDuplicate = transaction("id-1", 5.0, TransactionType.EXPENSE, budget("bx", 0, 5.0));
        sameItemDuplicate.setPlaidItemId("item-1");
        // The fingerprint query returns the "first" identical transaction, but it
        // was synced by the SAME Item, so it must NOT be merged into.
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(sameItemDuplicate));

        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        upsert(plaidTx("id-1", "STARBUCKS", "Food", 5.0, date, "USD", null));
        upsert(plaidTx("id-2", "STARBUCKS", "Food", 5.0, date, "USD", null));

        // Both are inserted: two legitimate transactions with identical values.
        verify(jdbcTemplate, times(2)).update(anyString(), any(Object[].class));
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    // ── Reconnect (new Item, new transaction ids) ────────────────────────────

    @Test
    void upsertTransaction_reconnectDifferentItem_mergesByFingerprint() {
        Budget budget = budget("b13", 500.0, 5.0);
        Transaction oldRow = transaction("old-1", 5.0, TransactionType.EXPENSE, budget);
        oldRow.setPlaidItemId("item-old");
        oldRow.setBaseCurrency("USD");
        oldRow.setUpdatedAt(Instant.parse("2026-01-20T00:00:00Z"));

        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("new-1", "user-1"))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(oldRow));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        // Reconnected Item "item-new" returns the same Starbucks under a new id.
        service.upsertTransaction(user(),
                plaidTx("new-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null),
                "item-new");

        // Merged into the existing row: no insert, the old row adopts the new id.
        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
        verify(transactionRepository).save(oldRow);
        assertEquals("new-1", oldRow.getPlaidTransactionId());
        assertEquals("item-new", oldRow.getPlaidItemId());
    }


    // ── Reconnect with multiple identical same-day transactions ──────────────

    @Test
    void reconnect_twoIdenticalSameDay_timestampDistinguishes_oneToOne() {
        Budget budget = budget("b20", 500.0, 10.0);
        Transaction e1 = existingRow("e1", "old-1", "item-old", 5.5, Instant.parse("2026-08-15T09:12:00Z"));
        Transaction e2 = existingRow("e2", "old-2", "item-old", 5.5, Instant.parse("2026-08-15T18:45:00Z"));

        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.5), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(e1, e2));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        // The reconnected Item re-serves both purchases under new ids but with
        // the same timestamps — each must be matched to a DIFFERENT existing row.
        service.upsertAddedBatch(user(), List.of(
                plaidTx("new-1", "STARBUCKS", "Food", 5.5, Instant.parse("2026-08-15T09:12:00Z"), "USD", null),
                plaidTx("new-2", "STARBUCKS", "Food", 5.5, Instant.parse("2026-08-15T18:45:00Z"), "USD", null)),
                "item-new");

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class)); // no inserts
        verify(transactionRepository).save(e1);
        verify(transactionRepository).save(e2);
        assertEquals("new-1", e1.getPlaidTransactionId());
        assertEquals("new-2", e2.getPlaidTransactionId());
        assertEquals("item-new", e1.getPlaidItemId());
        assertEquals("item-new", e2.getPlaidItemId());
    }

    @Test
    void reconnect_threeIdenticalSameDay_timestampDistinguishes_oneToOne() {
        Budget budget = budget("b21", 500.0, 0.0);
        Transaction e1 = existingRow("e1", "old-1", "item-old", 5.0, Instant.parse("2026-08-15T09:00:00Z"));
        Transaction e2 = existingRow("e2", "old-2", "item-old", 5.0, Instant.parse("2026-08-15T13:00:00Z"));
        Transaction e3 = existingRow("e3", "old-3", "item-old", 5.0, Instant.parse("2026-08-15T18:00:00Z"));

        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(e1, e2, e3));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertAddedBatch(user(), List.of(
                plaidTx("new-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T09:00:00Z"), "USD", null),
                plaidTx("new-2", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T13:00:00Z"), "USD", null),
                plaidTx("new-3", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T18:00:00Z"), "USD", null)),
                "item-new");

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
        verify(transactionRepository).save(e1);
        verify(transactionRepository).save(e2);
        verify(transactionRepository).save(e3);
        assertEquals("new-1", e1.getPlaidTransactionId());
        assertEquals("new-2", e2.getPlaidTransactionId());
        assertEquals("new-3", e3.getPlaidTransactionId());
    }


    @Test
    void reconnect_twoIdenticalSameDay_noTimestamps_ambiguous_doesNotMerge() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(
                        existingRow("e1", "old-1", "item-old", 5.0, Instant.parse("2026-08-15T00:00:00Z")),
                        existingRow("e2", "old-2", "item-old", 5.0, Instant.parse("2026-08-15T00:00:00Z"))));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // Two identical same-day purchases with no Plaid timestamp are
        // indistinguishable — the reconnect must NOT merge either of them.
        service.upsertAddedBatch(user(), List.of(
                plaidTx("new-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T00:00:00Z"), "USD", null),
                plaidTx("new-2", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T00:00:00Z"), "USD", null)),
                "item-new");

        verify(jdbcTemplate, times(2)).update(anyString(), any(Object[].class)); // both inserted
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void reconnect_twoCandidatesSameTimestamp_ambiguous_doesNotMerge() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(
                        existingRow("e1", "old-1", "item-old", 5.0, Instant.parse("2026-08-15T09:12:00Z")),
                        existingRow("e2", "old-2", "item-old", 5.0, Instant.parse("2026-08-15T09:12:00Z"))));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // Two candidates at the exact same instant as the incoming transaction —
        // the timestamp cannot decide which is the same logical transaction.
        service.upsertTransaction(user(),
                plaidTx("new-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T09:12:00Z"), "USD", null),
                "item-new");

        verify(jdbcTemplate, times(1)).update(anyString(), any(Object[].class)); // inserted, not merged
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void reconnect_timestampDiffersSlightly_doesNotMerge() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(
                        existingRow("e1", "old-1", "item-old", 5.0, Instant.parse("2026-08-15T09:00:00Z")),
                        existingRow("e2", "old-2", "item-old", 5.0, Instant.parse("2026-08-15T18:00:00Z"))));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // The reconnected timestamp drifted by 5 minutes: it no longer matches
        // EXACTLY, so the "closest" candidate is NOT evidence — insert instead.
        service.upsertTransaction(user(),
                plaidTx("new-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T09:05:00Z"), "USD", null),
                "item-new");

        verify(jdbcTemplate, times(1)).update(anyString(), any(Object[].class)); // inserted, not merged
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void reconnect_twoClosePurchases_incomingBetween_doesNotMerge() {
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.5), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(
                        existingRow("e1", "old-1", "item-old", 5.5, Instant.parse("2026-08-15T10:00:00Z")),
                        existingRow("e2", "old-2", "item-old", 5.5, Instant.parse("2026-08-15T10:30:00Z"))));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // The user made a 10:00 and a 10:30 purchase. A reconnected 10:20 record
        // matches neither timestamp exactly — 10:30 being "closest" (10 min) is
        // NOT evidence. It must be inserted, never merged.
        service.upsertTransaction(user(),
                plaidTx("new-1", "STARBUCKS", "Food", 5.5, Instant.parse("2026-08-15T10:20:00Z"), "USD", null),
                "item-new");

        verify(jdbcTemplate, times(1)).update(anyString(), any(Object[].class)); // inserted
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void reconnect_twoIncomingSameTimestamp_cannotCollapseIntoOneExisting() {
        Budget budget = budget("b23", 500.0, 5.0);
        Transaction e1 = existingRow("e1", "old-1", "item-old", 5.0, Instant.parse("2026-08-15T10:00:00Z"));
        e1.setBudget(budget);

        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        eq("user-1"), any(Instant.class), any(Instant.class), eq(5.0), eq(TransactionType.EXPENSE), eq("STARBUCKS")))
                .thenReturn(List.of(e1));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // Two incoming transactions with the SAME timestamp as the single
        // existing row: the first merges, the second must NOT collapse into it.
        service.upsertAddedBatch(user(), List.of(
                plaidTx("new-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T10:00:00Z"), "USD", null),
                plaidTx("new-2", "STARBUCKS", "Food", 5.0, Instant.parse("2026-08-15T10:00:00Z"), "USD", null)),
                "item-new");

        verify(transactionRepository, times(1)).save(e1);            // exactly one merge
        verify(jdbcTemplate, times(1)).update(anyString(), any(Object[].class)); // second one inserted
    }


    // ── Pending → posted ─────────────────────────────────────────────────────

    @Test
    void upsertTransaction_postedReconcilesWithPending() {
        Budget budget = budget("b14", 500.0, 5.0);
        Transaction pendingRow = transaction("pend-1", 5.0, TransactionType.EXPENSE, budget);
        pendingRow.setPlaidItemId("item-1");
        pendingRow.setUpdatedAt(Instant.parse("2026-01-20T00:00:00Z"));

        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("post-1", "user-1"))
                .thenReturn(Optional.empty());
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("pend-1", "user-1"))
                .thenReturn(Optional.of(pendingRow));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        // The posted transaction links to the pending transaction we stored.
        service.upsertTransaction(user(),
                plaidTx("post-1", "pend-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null),
                "item-1");

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class)); // no new row
        verify(transactionRepository).save(pendingRow);
        assertEquals("post-1", pendingRow.getPlaidTransactionId());  // adopts the posted id
        assertEquals("pend-1", pendingRow.getPlaidPendingTransactionId());
    }

    @Test
    void upsertTransaction_pendingAndPosted_sameBatch_persistsOnce() {
        Budget budget = budget("b15", 500.0, 0.0);
        Transaction pendingRow = transaction("pend-2", 5.0, TransactionType.EXPENSE, budget);
        pendingRow.setPlaidItemId("item-1");
        pendingRow.setUpdatedAt(Instant.parse("2026-01-20T00:00:00Z"));

        // Pending first (insert), then the posted transaction references it.
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("pend-2", "user-1"))
                .thenReturn(Optional.empty(), Optional.of(pendingRow));
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("post-2", "user-1"))
                .thenReturn(Optional.empty());
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        service.upsertTransaction(user(),
                plaidTx("pend-2", null, "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null),
                "item-1");
        service.upsertTransaction(user(),
                plaidTx("post-2", "pend-2", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null),
                "item-1");

        // One insert (pending), one update (posted reconciles into the pending row).
        verify(jdbcTemplate, times(1)).update(anyString(), any(Object[].class));
        verify(transactionRepository, times(1)).save(pendingRow);
        assertEquals("post-2", pendingRow.getPlaidTransactionId());
    }

    // ── Insert conflict (concurrent sync won the race) ───────────────────────

    @Test
    void upsertTransaction_insertConflict_reconcilesExistingRow() {
        Budget budget = budget("b16", 500.0, 5.0);
        Transaction stored = transaction("conf-1", 5.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("conf-1", "user-1"))
                .thenReturn(Optional.empty(), Optional.of(stored));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        // Native insert is skipped (ON CONFLICT DO NOTHING) — another sync won.
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0);

        upsert(plaidTx("conf-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null));

        verify(transactionRepository).save(stored); // reconciled as an update instead
        assertEquals(5.0, budget.getSpent());       // no double increment
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

