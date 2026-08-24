package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

/**
 * End-to-end tests proving the Plaid transaction persistence layer is
 * idempotent against the real database, including the unique index on
 * {@code plaid_transaction_id}. These exercise the actual
 * {@link PlaidTransactionIngestService} (no mocks), so the SQL upsert (a new
 * id inserts a row, a known id updates the existing row in place) is verified
 * end to end. After a disconnect + reconnect Plaid re-serves transactions
 * under new ids, which are inserted as-is.
 */
class PlaidTransactionDedupIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private PlaidTransactionIngestService ingestService;

    @Autowired
    private PlaidItemRepository plaidItemRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User createUser() {
        return createUser("plaid-dedup-" + UUID.randomUUID() + "@example.com", "Password123!", "plaid-dedup");
    }

    private PlaidItem item(String itemId, User user) {
        PlaidItem item = new PlaidItem();
        item.setItemId(itemId);
        item.setAccessTokenEncrypted("encrypted-" + itemId);
        item.setInstitutionName("Test Bank");
        item.setUser(user);
        return plaidItemRepository.save(item);
    }

    private PlaidTransaction tx(String id, String name, double amount, Instant date) {
        return new PlaidTransaction(id, name, date, "Food", amount, false, "USD", null, null, null, null);
    }

    private List<Transaction> userTransactions(User user) {
        return transactionRepository.findByUser_IdOrderByDateDesc(user.getId());
    }

    // ── Same transaction synced repeatedly (webhook retries / cursor replays) ─

    @Test
    void sameTransactionSyncedTwice_persistsOnce() {
        User user = createUser();
        PlaidItem item = item("item-1", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        ingestService.upsertTransaction(user, tx("t-1", "STARBUCKS", 5.0, date));
        ingestService.upsertTransaction(user, tx("t-1", "STARBUCKS", 5.0, date));
        ingestService.upsertTransaction(user, tx("t-1", "STARBUCKS", 5.0, date));

        List<Transaction> stored = userTransactions(user);
        assertEquals(1, stored.size());
        assertEquals("t-1", stored.get(0).getPlaidTransactionId());
    }

    @Test
    void multipleTransactionsSyncedTwice_persistsOnceEach() {
        User user = createUser();
        PlaidItem item = item("item-2", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        ingestService.upsertTransaction(user, tx("A", "STARBUCKS", 5.0, date));
        ingestService.upsertTransaction(user, tx("B", "UBER", 18.0, date));
        ingestService.upsertTransaction(user, tx("C", "CVS", 12.0, date));
        ingestService.upsertTransaction(user, tx("A", "STARBUCKS", 5.0, date));
        ingestService.upsertTransaction(user, tx("B", "UBER", 18.0, date));
        ingestService.upsertTransaction(user, tx("C", "CVS", 12.0, date));

        assertEquals(3, userTransactions(user).size());
    }

    // ── Identical values, different ids ──────────────────────────────────────

    @Test
    void identicalTransactionsDifferentIds_sameItem_remainDistinct() {
        User user = createUser();
        PlaidItem item = item("item-3", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        // Two legitimate $5 Starbucks purchases on the same day.
        ingestService.upsertTransaction(user, tx("id-1", "STARBUCKS", 5.0, date));
        ingestService.upsertTransaction(user, tx("id-2", "STARBUCKS", 5.0, date));

        assertEquals(2, userTransactions(user).size());
    }

    @Test
    void threeIdenticalSameDay_persistsAsThree() {
        User user = createUser();
        PlaidItem item = item("item-3x", user);

        ingestService.upsertTransaction(
                user, tx("a-1", "STARBUCKS", 5.5, Instant.parse("2026-08-15T09:00:00Z")));
        ingestService.upsertTransaction(
                user, tx("a-2", "STARBUCKS", 5.5, Instant.parse("2026-08-15T13:00:00Z")));
        ingestService.upsertTransaction(
                user, tx("a-3", "STARBUCKS", 5.5, Instant.parse("2026-08-15T18:00:00Z")));

        assertEquals(3, userTransactions(user).size());
    }

    // ── Concurrent insertion ─────────────────────────────────────────────────
    // Runs without the outer test transaction: the worker threads open their own
    // transactions, so the setup must be committed before they start and cleaned
    // up explicitly afterwards.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void concurrentSameTransactionInsert_persistsOnce() throws Exception {
        User user = createUser();
        PlaidItem item = item("item-5", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        PlaidTransaction plaidTx = tx("conc-1", "STARBUCKS", 5.0, date);

        int workers = 2;
        ExecutorService pool = Executors.newFixedThreadPool(workers);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(workers);
        for (int i = 0; i < workers; i++) {
            pool.submit(() -> {
                try {
                    start.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                try {
                    ingestService.upsertTransaction(user, plaidTx);
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertTrue(done.await(30, TimeUnit.SECONDS), "workers did not finish");
        pool.shutdownNow();

        assertEquals(1, userTransactions(user).size());

        // These writes committed on worker threads, outside the test rollback scope.
        cleanup(user);
    }

    // ── Database constraint ──────────────────────────────────────────────────

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void uniqueConstraint_blocksDuplicatePlaidId() {
        User user = createUser();
        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        String userId = user.getId();

        jdbcTemplate.update("""
                INSERT INTO transactions (id, name, transaction_date, category, type, amount,
                    plaid_transaction_id, user_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                """,
                UUID.randomUUID().toString(), "A", Timestamp.from(date), "Food", "EXPENSE", 5.0, "uniq-1", userId);

        assertThrows(DataIntegrityViolationException.class, () ->
                jdbcTemplate.update("""
                        INSERT INTO transactions (id, name, transaction_date, category, type, amount,
                            plaid_transaction_id, user_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                        """,
                        UUID.randomUUID().toString(), "A", Timestamp.from(date), "Food", "EXPENSE", 5.0, "uniq-1", userId));

        cleanup(user);
    }

    // ── Item-level pessimistic lock (PlaidService.fetchAndApplySyncPage) ──────
    // Two concurrent /transactions/sync page processors for the same item must
    // serialize on the plaid_items row lock, and the second must observe the
    // cursor committed by the first. Runs without the outer test transaction:
    // the worker threads open their own transactions.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void pessimisticItemLock_serializesConcurrentPageProcessors() throws Exception {
        User user = createUser();
        item("lock-item-1", user);

        CountDownLatch lockAcquired = new CountDownLatch(1);
        CountDownLatch releaseLock = new CountDownLatch(1);
        AtomicReference<String> firstReadCursor = new AtomicReference<>();
        AtomicReference<String> secondReadCursor = new AtomicReference<>();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // Thread A: takes the row lock, signals, then holds the transaction open.
            Future<?> first = pool.submit(() ->
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        PlaidItem locked = plaidItemRepository.findByItemIdForUpdate("lock-item-1").orElseThrow();
                        firstReadCursor.set(locked.getCursor());
                        lockAcquired.countDown();
                        try {
                            releaseLock.await(5, TimeUnit.SECONDS);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        }
                        locked.setCursor("cursor-after-a");
                        plaidItemRepository.save(locked);
                    }));
            assertTrue(lockAcquired.await(5, TimeUnit.SECONDS), "first processor did not take the row lock");

            // Thread B: must block on the row lock until A commits its cursor.
            Future<?> second = pool.submit(() ->
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        PlaidItem locked = plaidItemRepository.findByItemIdForUpdate("lock-item-1").orElseThrow();
                        secondReadCursor.set(locked.getCursor());
                    }));

            Thread.sleep(300);
            assertNull(secondReadCursor.get(), "second processor must wait for the first to commit");

            releaseLock.countDown();
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);

            assertNotNull(secondReadCursor.get(), "second processor must proceed after the first commits");
            assertEquals("cursor-after-a", secondReadCursor.get(),
                    "second processor must read the cursor committed by the first");
        } finally {
            releaseLock.countDown();
            pool.shutdownNow();
            cleanup(user);
        }
    }

    // ── Transfers (movement between the user's own accounts) ─────────────────
    // A transfer is ingested into history but never linked to a budget and
    // never counted toward income or expense aggregates. Runs without the outer
    // test transaction because the ingest path performs a native INSERT.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void transferTransaction_ingestedWithoutBudgetAndExcludedFromSums() {
        User user = createUser();
        item("item-transfer", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction transferOut =
                new PlaidTransaction("tr-out-1", "Transfer to Savings", date, "Transfer", 2000.0, true, "USD", null, null, null, null);
        PlaidTransaction transferIn =
                new PlaidTransaction("tr-in-1", "Transfer from Checking", date, "Transfer", -2000.0, true, "USD", null, null, null, null);

        ingestService.upsertTransaction(user, transferOut);
        ingestService.upsertTransaction(user, transferIn);

        List<Transaction> stored = userTransactions(user);
        assertEquals(2, stored.size());
        assertTrue(stored.stream().allMatch(Transaction::isTransfer));

        // Transfers are not budgeted, so no budget was auto-created.
        assertEquals(0, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());

        // Transfers must not count as income or expenses in aggregates.
        assertEquals(0.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, date.plusSeconds(1)));
        assertEquals(0.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, date.plusSeconds(1)));

        cleanup(user);
    }

    // ── Payroll is income; internal transfers never touch the totals ─────────

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void payrollIncomeCountedAndTransfersExcludedFromSums() {
        User user = createUser();
        item("item-payroll", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        // A payroll deposit (money in) is real income, never a transfer.
        PlaidTransaction payroll =
                new PlaidTransaction("pay-1", "Payroll Deposit", date, "Income", -2500.0, false, "USD", null, null, null, null);
        // An internal transfer pair (Checking → Savings).
        PlaidTransaction transferOut =
                new PlaidTransaction("tr-out-2", "Transfer to Savings", date, "Transfer", 2000.0, true, "USD", null, null, null, null);
        PlaidTransaction transferIn =
                new PlaidTransaction("tr-in-2", "Transfer from Checking", date, "Transfer", -2000.0, true, "USD", null, null, null, null);
        // A real purchase.
        PlaidTransaction purchase =
                new PlaidTransaction("buy-1", "Groceries", date, "Food", 100.0, false, "USD", null, null, null, null);

        ingestService.upsertTransaction(user, payroll);
        ingestService.upsertTransaction(user, transferOut);
        ingestService.upsertTransaction(user, transferIn);
        ingestService.upsertTransaction(user, purchase);

        // Income = only the payroll deposit; the $2,000 transfer-in is excluded.
        assertEquals(2500.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, date.plusSeconds(1)));
        // Expenses = only the purchase; the $2,000 transfer-out is excluded.
        assertEquals(100.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, date.plusSeconds(1)));

        cleanup(user);
    }

    // ── Credit card payments are transfers between the user's accounts ──────
    // Both sides of a credit card payment — the debit on the funding account and
    // the credit posted to the card — move the user's existing money and must
    // have zero income/expense impact.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void creditCardPaymentPair_storedAsTransfersAndExcludedFromSums() {
        User user = createUser();
        item("item-cc", user);
        Instant date = Instant.parse("2026-01-15T00:00:00Z");

        // The debit on the funding account (money out).
        PlaidTransaction paymentOut =
                new PlaidTransaction("cc-out-1", "PAYMENT THANK YOU", date, "Credit Card Payment", 500.0, true, "USD", null, null, null, null);
        // The credit posted to the card (money in) — the other side of the same
        // payment. It must be a transfer too, never income.
        PlaidTransaction paymentCredit =
                new PlaidTransaction("cc-in-1", "PAYMENT THANK YOU", date, "Credit Card Payment", -500.0, true, "USD", null, null, null, null);

        ingestService.upsertTransaction(user, paymentOut);
        ingestService.upsertTransaction(user, paymentCredit);

        List<Transaction> stored = userTransactions(user);
        assertEquals(2, stored.size());
        assertTrue(stored.stream().allMatch(Transaction::isTransfer));
        // The app persists absolute amounts; the direction lives in the type.
        Transaction debit = stored.stream().filter(t -> t.getPlaidTransactionId().equals("cc-out-1"))
                .findFirst().orElseThrow();
        assertEquals(500.0, debit.getAmount());
        assertEquals(TransactionType.EXPENSE, debit.getType());
        Transaction credit = stored.stream().filter(t -> t.getPlaidTransactionId().equals("cc-in-1"))
                .findFirst().orElseThrow();
        assertEquals(500.0, credit.getAmount());
        assertEquals(TransactionType.INCOME, credit.getType());

        // Neither side counts as income or spending.
        assertEquals(0.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, date.plusSeconds(1)));
        assertEquals(0.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, date.plusSeconds(1)));

        cleanup(user);
    }

    // ── Mixed month: payroll + purchases + an internal transfer pair ────────
    // The transfer pair ($2,000 of movement) must have ZERO effect on the
    // month's financial summary. Income = $2,500 payroll, Expenses = $400.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void mixedMonth_payrollAndPurchasesCounted_transfersHaveZeroEffect() {
        User user = createUser();
        item("item-mixed", user);
        Instant date = Instant.parse("2026-03-10T00:00:00Z");

        // +$2,500 payroll deposit (money in).
        PlaidTransaction payroll =
                new PlaidTransaction("mix-pay-1", "Payroll Deposit", date, "Income", -2500.0, false, "USD", null, null, null, null);
        // -$300 purchase.
        PlaidTransaction purchase1 =
                new PlaidTransaction("mix-buy-1", "Groceries", date, "Food", 300.0, false, "USD", null, null, null, null);
        // -$1,000 Checking → Savings.
        PlaidTransaction transferOut =
                new PlaidTransaction("mix-tr-out", "Transfer to Savings", date, "Transfer", 1000.0, true, "USD", null, null, null, null);
        // +$1,000 Savings ← Checking (the other side of the same transfer).
        PlaidTransaction transferIn =
                new PlaidTransaction("mix-tr-in", "Transfer from Checking", date, "Transfer", -1000.0, true, "USD", null, null, null, null);
        // -$100 purchase.
        PlaidTransaction purchase2 =
                new PlaidTransaction("mix-buy-2", "Dining", date, "Food", 100.0, false, "USD", null, null, null, null);

        ingestService.upsertTransaction(user, payroll);
        ingestService.upsertTransaction(user, purchase1);
        ingestService.upsertTransaction(user, transferOut);
        ingestService.upsertTransaction(user, transferIn);
        ingestService.upsertTransaction(user, purchase2);

        // All five transactions are stored with their original amounts.
        List<Transaction> stored = userTransactions(user);
        assertEquals(5, stored.size());
        assertEquals(2, stored.stream().filter(Transaction::isTransfer).count());

        // Income = $2,500 (payroll only; the $1,000 transfer-in is excluded).
        assertEquals(2500.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, date.plusSeconds(1)));
        // Expenses = $300 + $100 = $400 (the $1,000 transfer-out is excluded).
        assertEquals(400.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, date.plusSeconds(1)));
        // Budget spent tracks only real purchases.
        assertEquals(400.0, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).stream()
                .mapToDouble(Budget::getSpent)
                .sum());

        cleanup(user);
    }

    // ── TEST 10 — Full monthly summary invariant ─────────────────────────────
    // $2,500 payroll + $300 groceries + $100 restaurant + a $1,000 transfer pair
    // + a $500 credit card payment pair must produce Income = $2,500 and
    // Expenses = $400. The $3,000 of transfer movement has zero effect.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void fullMonthlySummary_payrollAndPurchasesCountedAllTransfersExcluded() {
        User user = createUser();
        item("item-summary", user);
        Instant date = Instant.parse("2026-05-15T00:00:00Z");

        // +$2,500 payroll deposit (real income).
        PlaidTransaction payroll =
                new PlaidTransaction("sum-pay-1", "Payroll Deposit", date, "Income", -2500.0, false, "USD", null, null, null, null);
        // -$300 groceries (real expense).
        PlaidTransaction groceries =
                new PlaidTransaction("sum-gro-1", "Groceries", date, "Food", 300.0, false, "USD", null, null, null, null);
        // -$100 restaurant (real expense).
        PlaidTransaction restaurant =
                new PlaidTransaction("sum-res-1", "Restaurant", date, "Food", 100.0, false, "USD", null, null, null, null);
        // -$1,000 Checking → Savings (internal transfer out).
        PlaidTransaction transferOut =
                new PlaidTransaction("sum-tr-out", "Transfer to Savings", date, "Transfer", 1000.0, true, "USD", null, null, null, null);
        // +$1,000 Savings ← Checking (internal transfer in).
        PlaidTransaction transferIn =
                new PlaidTransaction("sum-tr-in", "Transfer from Checking", date, "Transfer", -1000.0, true, "USD", null, null, null, null);
        // -$500 credit card payment (settlement of existing card debt — transfer).
        PlaidTransaction cardPayment =
                new PlaidTransaction("sum-cc-pay", "PAYMENT THANK YOU", date, "Credit Card Payment", 500.0, true, "USD", null, null, null, null);
        // +$500 credit card payment received (the other side of the payment — transfer).
        PlaidTransaction cardPaymentReceived =
                new PlaidTransaction("sum-cc-rec", "PAYMENT THANK YOU", date, "Credit Card Payment", -500.0, true, "USD", null, null, null, null);

        for (PlaidTransaction tx : List.of(payroll, groceries, restaurant, transferOut, transferIn, cardPayment, cardPaymentReceived)) {
            ingestService.upsertTransaction(user, tx);
        }

        List<Transaction> stored = userTransactions(user);
        assertEquals(7, stored.size());
        // Exactly the four transfer transactions are flagged.
        assertEquals(4, stored.stream().filter(Transaction::isTransfer).count());

        // Income = $2,500 (payroll only).
        assertEquals(2500.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, date.plusSeconds(1)));
        // Expenses = $300 + $100 = $400 (transfers and card payment excluded).
        assertEquals(400.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, date.plusSeconds(1)));
        // Budget spent tracks only the real purchases.
        assertEquals(400.0, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).stream()
                .mapToDouble(Budget::getSpent)
                .sum());

        cleanup(user);
    }

    // ── Safe default: category-signaled money is income/expense, not transfer ─
    // The detector cannot prove same-user/same-institution ownership, so
    // TRANSFER_IN/OUT and loan categories default to is_transfer = false.
    // Money in counts as income; money out counts as an expense.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void transferCategorizedTransactions_defaultToIncomeAndExpense() {
        User user = createUser();
        item("item-safe-default", user);
        Instant date = Instant.parse("2026-07-10T00:00:00Z");

        // Venmo-like incoming payment (money in, category signals transfer).
        PlaidTransaction p2pIn =
                new PlaidTransaction("sd-in-1", "Venmo", date, "Transfer", -200.0, false, "USD", null, null, null, null);
        // Loan payment (money out to an external lender).
        PlaidTransaction loanOut =
                new PlaidTransaction("sd-out-1", "Oportun", date, "Loan Payments", 387.97, false, "USD", null, null, null, null);
        // A same-bank checking → savings leg whose ownership cannot be proven.
        PlaidTransaction transferLegOut =
                new PlaidTransaction("sd-out-2", "Transfer to Savings", date, "Transfer", 1000.0, false, "USD", null, null, null, null);

        ingestService.upsertTransaction(user, p2pIn);
        ingestService.upsertTransaction(user, loanOut);
        ingestService.upsertTransaction(user, transferLegOut);

        List<Transaction> stored = userTransactions(user);
        assertEquals(3, stored.size());
        assertTrue(stored.stream().noneMatch(Transaction::isTransfer));

        // Money in → income; money out → expense (no false exclusions).
        assertEquals(200.0, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, date.plusSeconds(1)));
        assertEquals(1387.97, transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, date.plusSeconds(1)));

        cleanup(user);
    }

    // ── Persisted Plaid account/item ownership ────────────────────────────────
    // These tests prove plaid_account_id and plaid_item_id are retained on the
    // transaction so same-institution account ownership can be established.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void plaidAccountIdAndItemId_persistedOnTransaction() {
        User user = createUser();
        item("item-123", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction plaidTx = new PlaidTransaction(
                "acct-item-1", "Starbucks", date, "Food", 5.0, false, "USD", null,
                "account-123", "item-123", null);
        ingestService.upsertTransaction(user, plaidTx);

        List<Transaction> stored = userTransactions(user);
        assertEquals(1, stored.size());
        Transaction tx = stored.get(0);
        // TEST 1 — account_id captured.
        assertEquals("account-123", tx.getPlaidAccountId());
        // TEST 2 — item_id captured.
        assertEquals("item-123", tx.getPlaidItemId());
        // TEST 4 — the transaction's user is the owner of the Plaid item.
        assertEquals(user.getId(), tx.getUser().getId());

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void plaidIds_areScopedToTheOwningUser() {
        User user = createUser();
        User other = createUser("other-user@example.com", "Password123!", "other-user");
        item("item-123", user);

        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        PlaidTransaction plaidTx = new PlaidTransaction(
                "own-1", "Starbucks", date, "Food", 5.0, false, "USD", null,
                "account-123", "item-123", null);
        ingestService.upsertTransaction(user, plaidTx);

        // The other user's item/transactions are untouched; no cross-user data.
        assertEquals(1, userTransactions(user).size());
        assertEquals(0, userTransactions(other).size());

        cleanup(user);
        cleanup(other);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void multipleAccountsSameItem_persistedWithDistinctAccountIds() {
        User user = createUser();
        item("item-123", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        // TEST 5 — Checking and Savings are two accounts under the same item.
        PlaidTransaction checking = new PlaidTransaction(
                "a-1", "Checking", date, "Food", 10.0, false, "USD", null, "checking-123", "item-123", null);
        PlaidTransaction savings = new PlaidTransaction(
                "b-1", "Savings", date, "Food", 20.0, false, "USD", null, "savings-123", "item-123", null);
        ingestService.upsertTransaction(user, checking);
        ingestService.upsertTransaction(user, savings);

        List<Transaction> stored = userTransactions(user);
        Transaction txA = byPlaidId(stored, "a-1");
        Transaction txB = byPlaidId(stored, "b-1");

        assertEquals("item-123", txA.getPlaidItemId());
        assertEquals("item-123", txB.getPlaidItemId());
        assertEquals("checking-123", txA.getPlaidAccountId());
        assertEquals("savings-123", txB.getPlaidAccountId());
        assertNotEquals(txA.getPlaidAccountId(), txB.getPlaidAccountId());

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void historicalTransactionWithoutPlaidIds_remainsNull() {
        // TEST 6 — legacy rows are not backfilled or fabricated.
        User user = createUser();
        Transaction legacy = createTransaction(
                user, null, "Legacy", Instant.parse("2024-05-01T00:00:00Z"),
                "Food", TransactionType.EXPENSE, 10.0);

        assertNull(legacy.getPlaidAccountId());
        assertNull(legacy.getPlaidItemId());

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void reServedTransaction_updatePathPreservesPlaidIds() {
        // TEST 7 — pending → posted: the same transaction_id re-served in the
        // modified array is updated in place and keeps the correct ids.
        User user = createUser();
        item("item-123", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction pending = new PlaidTransaction(
                "pd-1", "Pending", date, "Food", 10.0, false, "USD", null, "account-123", "item-123", null);
        PlaidTransaction posted = new PlaidTransaction(
                "pd-1", "Posted", date, "Food", 10.0, false, "USD", null, "account-123", "item-123", null);
        ingestService.upsertTransaction(user, pending);
        ingestService.upsertTransaction(user, posted);

        List<Transaction> stored = userTransactions(user);
        assertEquals(1, stored.size()); // updated in place, not duplicated
        Transaction tx = stored.get(0);
        assertEquals("Posted", tx.getName());
        assertEquals("account-123", tx.getPlaidAccountId());
        assertEquals("item-123", tx.getPlaidItemId());

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void plaidIdsPersistence_doesNotAffectIsTransfer() {
        // TEST 8 — the data-persistence change is independent of classification.
        User user = createUser();
        item("item-123", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction transfer = new PlaidTransaction(
                "tr-ids", "Transfer to Savings", date, "Transfer", 1000.0, true, "USD", null,
                "checking-123", "item-123", null);
        ingestService.upsertTransaction(user, transfer);

        Transaction tx = userTransactions(user).get(0);
        assertTrue(tx.isTransfer());
        assertEquals("checking-123", tx.getPlaidAccountId());
        assertEquals("item-123", tx.getPlaidItemId());

        cleanup(user);
    }

    // ── Proof-based internal-transfer detection ───────────────────────────────
    // is_transfer = true ONLY for movements between the same user's accounts
    // under the same Plaid item, proven by a same-day, equal-amount,
    // opposite-direction pair on two different accounts.

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void internalTransfer_sameItemCheckingToSavings_markedTransferZeroFinancialImpact() {
        User user = createUser();
        item("item-tr1", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

                // Checking → Savings: both legs carry account/item ownership.
        PlaidTransaction checking = new PlaidTransaction(
                "tr-out", "Transfer to Savings", date, "Transfer", 1000.0, false, "USD", null,
                "checking-1", "item-tr1", "TRANSFER_TRANSFER_ACCOUNT_TRANSFER");
        PlaidTransaction savings = new PlaidTransaction(
                "tr-in", "Transfer from Checking", date, "Transfer", -1000.0, false, "USD", null,
                "savings-1", "item-tr1", "TRANSFER_TRANSFER_ACCOUNT_TRANSFER");
        ingestService.upsertTransaction(user, checking);
        ingestService.upsertTransaction(user, savings);

        List<Transaction> stored = userTransactions(user);
        assertEquals(2, stored.size());
        // TEST 1 — both legs are proven internal transfers.
        assertTrue(stored.stream().allMatch(Transaction::isTransfer));
        // Zero financial impact.
        assertEquals(0.0, income(user, date.plusSeconds(1)));
        assertEquals(0.0, expenses(user, date.plusSeconds(1)));
        assertEquals(0.0, totalBudgetSpent(user));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void noCounterpart_singleLegRemainsExpense() {
        User user = createUser();
        item("item-only", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction checking = new PlaidTransaction(
                "only-out", "Transfer to Savings", date, "Transfer", 1000.0, false, "USD", null,
                "checking-1", "item-only", null);
        ingestService.upsertTransaction(user, checking);

        // TEST 2 — no user-owned counterpart under the same item → expense.
        Transaction stored = userTransactions(user).get(0);
        assertFalse(stored.isTransfer());
        assertEquals(1000.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void differentUsers_doNotPairAcrossUsers() {
        User userA = createUser();
        User userB = createUser("other-pair@example.com", "Password123!", "other-pair");
        item("item-ua", userA);
        item("item-ub", userB);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        // Same amount/date, but different users (and different items).
        PlaidTransaction outA = new PlaidTransaction(
                "a-out", "Checking", date, "Transfer", 1000.0, false, "USD", null, "checking-1", "item-ua", null);
        PlaidTransaction inB = new PlaidTransaction(
                "b-in", "Savings", date, "Transfer", -1000.0, false, "USD", null, "savings-1", "item-ub", null);
        ingestService.upsertTransaction(userA, outA);
        ingestService.upsertTransaction(userB, inB);

        // TEST 3 — one user's transaction can never pair with another user's.
        assertFalse(userTransactions(userA).get(0).isTransfer());
        assertFalse(userTransactions(userB).get(0).isTransfer());
        assertEquals(1000.0, expenses(userA, date.plusSeconds(1)));
        assertEquals(1000.0, income(userB, date.plusSeconds(1)));

        cleanup(userA);
        cleanup(userB);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void differentPlaidItems_sameUser_doNotPair() {
        User user = createUser();
        item("item-ia", user);
        item("item-ib", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction outA = new PlaidTransaction(
                "a-out", "Checking", date, "Transfer", 1000.0, false, "USD", null, "checking-1", "item-ia", null);
        PlaidTransaction inB = new PlaidTransaction(
                "b-in", "Savings", date, "Transfer", -1000.0, false, "USD", null, "savings-1", "item-ib", null);
        ingestService.upsertTransaction(user, outA);
        ingestService.upsertTransaction(user, inB);

        // TEST 4 — different institutions are never an internal transfer.
        assertFalse(byPlaidId(userTransactions(user), "a-out").isTransfer());
        assertFalse(byPlaidId(userTransactions(user), "b-in").isTransfer());
        assertEquals(1000.0, expenses(user, date.plusSeconds(1)));
        assertEquals(1000.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void payroll_isIncomeNotTransfer() {
        User user = createUser();
        item("item-pay", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction payroll = new PlaidTransaction(
                "pay-1", "Payroll Deposit", date, "Income", -2500.0, false, "USD", null,
                "checking-1", "item-pay", null);
        ingestService.upsertTransaction(user, payroll);

        // TEST 5 — payroll is income, never an internal transfer.
        assertFalse(userTransactions(user).get(0).isTransfer());
        assertEquals(2500.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void loanPayment_isExpenseNotTransfer() {
        User user = createUser();
        item("item-loan", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction loan = new PlaidTransaction(
                "loan-1", "Oportun", date, "Loan Payments", 500.0, false, "USD", null,
                "checking-1", "item-loan", null);
        ingestService.upsertTransaction(user, loan);

        // TEST 6 — no user-owned counterpart → real expense.
        assertFalse(userTransactions(user).get(0).isTransfer());
        assertEquals(500.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void creditCardPurchase_isExpenseNotTransfer() {
        User user = createUser();
        item("item-ccbuy", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction purchase = new PlaidTransaction(
                "buy-1", "Netflix", date, "Entertainment", 200.0, false, "USD", null,
                "card-1", "item-ccbuy", null);
        ingestService.upsertTransaction(user, purchase);

        // TEST 7 — an ordinary purchase is spending, never a transfer.
        assertFalse(userTransactions(user).get(0).isTransfer());
        assertEquals(200.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void creditCardPayment_provenSameItemPair_isTransfer() {
        User user = createUser();
        item("item-ccpay", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        // Checking pays the user's own card: both accounts under item-ccpay.
        PlaidTransaction payment = new PlaidTransaction(
                "cc-pay", "Payment Thank You", date, "Credit Card Payment", 500.0, false, "USD", null,
                "checking-1", "item-ccpay", null);
        PlaidTransaction credit = new PlaidTransaction(
                "cc-credit", "Payment Thank You", date, "Credit Card Payment", -500.0, false, "USD", null,
                "card-1", "item-ccpay", null);
        ingestService.upsertTransaction(user, payment);
        ingestService.upsertTransaction(user, credit);

        // TEST 8 — proven same-item pair → transfer, zero financial impact.
        List<Transaction> stored = userTransactions(user);
        assertTrue(stored.stream().allMatch(Transaction::isTransfer));
        assertEquals(0.0, income(user, date.plusSeconds(1)));
        assertEquals(0.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void venmoIncoming_isIncomeNotTransfer() {
        User user = createUser();
        item("item-ven", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction venmo = new PlaidTransaction(
                "venmo-1", "Venmo", date, "Transfer", -500.0, false, "USD", null,
                "checking-1", "item-ven", null);
        ingestService.upsertTransaction(user, venmo);

        // TEST 9 — no same-item user-owned counterpart → income.
        assertFalse(userTransactions(user).get(0).isTransfer());
        assertEquals(500.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void cashDeposit_isIncomeNotTransfer() {
        User user = createUser();
        item("item-cash", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction cash = new PlaidTransaction(
                "cash-1", "Cash Deposit", date, "Deposit", -500.0, false, "USD", null,
                "checking-1", "item-cash", null);
        ingestService.upsertTransaction(user, cash);

        // TEST 10 — cash deposits are real money in, never a transfer.
        assertFalse(userTransactions(user).get(0).isTransfer());
        assertEquals(500.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void refund_isNotTransfer_keepsExistingBehavior() {
        User user = createUser();
        item("item-ref", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        PlaidTransaction refund = new PlaidTransaction(
                "ref-1", "Refund", date, "Refund", -45.0, false, "USD", null,
                "card-1", "item-ref", null);
        ingestService.upsertTransaction(user, refund);

        // TEST 11 — refunds are never transfers; they stay money in.
        assertFalse(userTransactions(user).get(0).isTransfer());
        assertEquals(45.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void monthlyInvariant_internalTransfersExcludedFromTotals() {
        User user = createUser();
        item("item-mi", user);

        Instant day1 = Instant.parse("2026-02-01T00:00:00Z");
        Instant day2 = Instant.parse("2026-02-02T00:00:00Z");
        Instant day3 = Instant.parse("2026-02-03T00:00:00Z");
        Instant day4 = Instant.parse("2026-02-04T00:00:00Z");
        Instant day5 = Instant.parse("2026-02-05T00:00:00Z");

        // +2500 payroll.
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-pay", "Payroll", day1, "Income", -2500.0, false, "USD", null, "checking-1", "item-mi", null));
        // -200 groceries.
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-gro", "Groceries", day1, "Food", 200.0, false, "USD", null, "checking-1", "item-mi", null));
        // -200 restaurant.
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-res", "Restaurant", day2, "Food", 200.0, false, "USD", null, "checking-1", "item-mi", null));
                // -1000 checking → savings (proven pair).
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-tro", "Transfer to Savings", day3, "Transfer", 1000.0, false, "USD", null, "checking-1", "item-mi", "TRANSFER_TRANSFER_ACCOUNT_TRANSFER"));
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-tri", "Transfer from Checking", day3, "Transfer", -1000.0, false, "USD", null, "savings-1", "item-mi", "TRANSFER_TRANSFER_ACCOUNT_TRANSFER"));
        // -500 credit-card purchase.
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-ccbuy", "Amazon", day4, "Shopping", 500.0, false, "USD", null, "card-1", "item-mi", "SHOPPING_ONLINE"));
        // -500 checking → credit-card payment (proven pair).
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-ccpay", "Payment Thank You", day5, "Credit Card Payment", 500.0, false, "USD", null, "checking-1", "item-mi", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"));
        ingestService.upsertTransaction(user, new PlaidTransaction(
                "m-cccred", "Payment Thank You", day5, "Credit Card Payment", -500.0, false, "USD", null, "card-1", "item-mi", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"));

        // TEST 12 — monthly invariant.
        assertEquals(8, userTransactions(user).size());
        assertEquals(4, userTransactions(user).stream().filter(Transaction::isTransfer).count());
        assertEquals(2500.0, income(user, day5.plusSeconds(1)));
        assertEquals(900.0, expenses(user, day5.plusSeconds(1)));
        assertEquals(900.0, totalBudgetSpent(user));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void sameAmountCoincidence_isNotATransfer() {
        // TEST 9 — two UNRELATED transactions: a real $500 expense from checking
        // and a real $500 income into savings, same user, same item, same day,
        // different accounts. Without the transfer-candidate gate these would
        // pair and silently vanish $500 of real spending AND $500 of real income.
        User user = createUser();
        item("item-9", user);
        Instant date = Instant.parse("2026-03-10T00:00:00Z");

        PlaidTransaction bill = new PlaidTransaction(
                "c-bill", "Utility Bill", date, "Bills", 500.0, false, "USD", null,
                "checking-1", "item-9", null);
        PlaidTransaction deposit = new PlaidTransaction(
                "c-dep", "External Deposit", date, "Income", -500.0, false, "USD", null,
                "savings-1", "item-9", null);
        ingestService.upsertTransaction(user, bill);
        ingestService.upsertTransaction(user, deposit);

        List<Transaction> stored = userTransactions(user);
        // Neither may be classified as a transfer: both carry no transfer
        // candidate signal, and real spending/income must not disappear.
        assertFalse(byPlaidId(stored, "c-bill").isTransfer());
        assertFalse(byPlaidId(stored, "c-dep").isTransfer());
        assertEquals(500.0, income(user, date.plusSeconds(1)));
        assertEquals(500.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void sameAmountCoincidence_oneLegTransferSignaled_stillNotATransfer() {
        // Even when ONE leg carries a transfer signal, the other does not — the
        // pair must not be treated as an internal transfer.
        User user = createUser();
        item("item-9b", user);
        Instant date = Instant.parse("2026-03-11T00:00:00Z");

        PlaidTransaction outgoing = new PlaidTransaction(
                "c-out", "Transfer to X", date, "Transfer", 750.0, false, "USD", null,
                "checking-1", "item-9b", null);
        PlaidTransaction incoming = new PlaidTransaction(
                "c-in", "Freelance Income", date, "Income", -750.0, false, "USD", null,
                "savings-1", "item-9b", null);
        ingestService.upsertTransaction(user, outgoing);
        ingestService.upsertTransaction(user, incoming);

        List<Transaction> stored = userTransactions(user);
        assertFalse(byPlaidId(stored, "c-out").isTransfer());
        assertFalse(byPlaidId(stored, "c-in").isTransfer());
        assertEquals(750.0, income(user, date.plusSeconds(1)));
        assertEquals(750.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void transferCategorizedPayroll_neverPairsIntoTransfer() {
        // Payroll filed as TRANSFER_PAYROLL must never become the income leg of
        // an internal-transfer pair, even with a same-day equal outbound leg.
        User user = createUser();
        item("item-pp", user);
        Instant date = Instant.parse("2026-03-12T00:00:00Z");

                PlaidTransaction payroll = new PlaidTransaction(
                "p-pay", "Payroll", date, "Transfer Payroll", -2500.0, false, "USD", null,
                "checking-1", "item-pp", "TRANSFER_PAYROLL");
        PlaidTransaction outbound = new PlaidTransaction(
                "p-out", "External Transfer", date, "Transfer", 2500.0, false, "USD", null,
                "savings-1", "item-pp", "TRANSFER_TRANSFER_ACCOUNT_TRANSFER");
        ingestService.upsertTransaction(user, payroll);
        ingestService.upsertTransaction(user, outbound);

        List<Transaction> stored = userTransactions(user);
        assertFalse(byPlaidId(stored, "p-pay").isTransfer());
        assertFalse(byPlaidId(stored, "p-out").isTransfer());
        assertEquals(2500.0, income(user, date.plusSeconds(1)));
        assertEquals(2500.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void refundUnderTransferUmbrella_neverPairsIntoTransfer() {
        // A refund under a transfer umbrella must not pair with an equal,
        // same-day outbound transfer-candidate expense.
        User user = createUser();
        item("item-rf", user);
        Instant date = Instant.parse("2026-03-13T00:00:00Z");

                PlaidTransaction refund = new PlaidTransaction(
                "r-ref", "Refund", date, "Transfer Refund", -100.0, false, "USD", null,
                "savings-1", "item-rf", "TRANSFER_REFUND");
        PlaidTransaction outbound = new PlaidTransaction(
                "r-out", "Transfer To X", date, "Transfer", 100.0, false, "USD", null,
                "checking-1", "item-rf", "TRANSFER_TRANSFER_ACCOUNT_TRANSFER");
        ingestService.upsertTransaction(user, refund);
        ingestService.upsertTransaction(user, outbound);

        List<Transaction> stored = userTransactions(user);
        assertFalse(byPlaidId(stored, "r-ref").isTransfer());
        assertFalse(byPlaidId(stored, "r-out").isTransfer());
        assertEquals(100.0, income(user, date.plusSeconds(1)));
        assertEquals(100.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void sameAccount_equalOppositeAmounts_neverATransfer() {
        // TEST 12 — two legs on the SAME account: an internal transfer must
        // move money between DIFFERENT accounts, so an equal/opposite pair on
        // one account is never a transfer.
        User user = createUser();
        item("item-sa", user);
        Instant date = Instant.parse("2026-03-14T00:00:00Z");

        PlaidTransaction out = new PlaidTransaction(
                "sa-out", "Transfer To Same", date, "Transfer", 400.0, false, "USD", null,
                "checking-1", "item-sa", null);
        PlaidTransaction in = new PlaidTransaction(
                "sa-in", "Transfer From Same", date, "Transfer", -400.0, false, "USD", null,
                "checking-1", "item-sa", null);
        ingestService.upsertTransaction(user, out);
        ingestService.upsertTransaction(user, in);

        List<Transaction> stored = userTransactions(user);
        assertFalse(byPlaidId(stored, "sa-out").isTransfer());
        assertFalse(byPlaidId(stored, "sa-in").isTransfer());
        assertEquals(400.0, income(user, date.plusSeconds(1)));
        assertEquals(400.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void threeLegsSameAmount_ambiguousGroup_isNeverATransfer() {
        // A (day, amount) group with three rows is ambiguous — the algorithm
        // requires EXACTLY two rows, so no leg may be classified as a transfer.
        User user = createUser();
        item("item-am", user);
        Instant date = Instant.parse("2026-03-15T00:00:00Z");

        PlaidTransaction a = new PlaidTransaction(
                "am-a", "Transfer Out A", date, "Transfer", 300.0, false, "USD", null,
                "checking-1", "item-am", null);
        PlaidTransaction b = new PlaidTransaction(
                "am-b", "Transfer Out B", date, "Transfer", 300.0, false, "USD", null,
                "savings-1", "item-am", null);
        PlaidTransaction c = new PlaidTransaction(
                "am-c", "Transfer In C", date, "Transfer", -300.0, false, "USD", null,
                "card-1", "item-am", null);
        ingestService.upsertTransaction(user, a);
        ingestService.upsertTransaction(user, b);
        ingestService.upsertTransaction(user, c);

        List<Transaction> stored = userTransactions(user);
        assertFalse(stored.stream().anyMatch(Transaction::isTransfer));
        assertEquals(300.0, income(user, date.plusSeconds(1)));
        assertEquals(600.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void outgoingCashApp_isExpenseNotTransfer() {
        // CASH APP TRANSFER -$20.00 must be an expense, never a transfer.
        User user = createUser();
        item("item-ca", user);
        Instant date = Instant.parse("2026-03-16T00:00:00Z");

        PlaidTransaction cashApp = new PlaidTransaction(
                "ca-1", "CASH APP TRANSFER", date, "Transfer", 20.0, false, "USD", null,
                "checking-1", "item-ca", "TRANSFER_OUT_THIRD_PARTY_P2P");
        ingestService.upsertTransaction(user, cashApp);

        List<Transaction> stored = userTransactions(user);
        assertFalse(stored.stream().anyMatch(Transaction::isTransfer));
        assertEquals(20.0, expenses(user, date.plusSeconds(1)));
        assertEquals(0.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void outgoingVenmo_isExpenseNotTransfer() {
        // -$145.09 Venmo must be an expense, never a transfer.
        User user = createUser();
        item("item-vmo", user);
        Instant date = Instant.parse("2026-03-16T00:00:00Z");

        PlaidTransaction venmo = new PlaidTransaction(
                "vmo-1", "VENMO", date, "Transfer", 145.09, false, "USD", null,
                "checking-1", "item-vmo", "TRANSFER_OUT_THIRD_PARTY_P2P");
        ingestService.upsertTransaction(user, venmo);

        List<Transaction> stored = userTransactions(user);
        assertFalse(stored.stream().anyMatch(Transaction::isTransfer));
        assertEquals(145.09, expenses(user, date.plusSeconds(1)));
        assertEquals(0.0, income(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void incomingVenmo_isIncomeNotTransfer() {
        // +$500 Venmo with no same-item counterpart → income, never a transfer.
        User user = createUser();
        item("item-vmi", user);
        Instant date = Instant.parse("2026-03-16T00:00:00Z");

        PlaidTransaction venmo = new PlaidTransaction(
                "vmi-1", "VENMO", date, "Transfer", -500.0, false, "USD", null,
                "checking-1", "item-vmi", "TRANSFER_IN_THIRD_PARTY_P2P");
        ingestService.upsertTransaction(user, venmo);

        List<Transaction> stored = userTransactions(user);
        assertFalse(stored.stream().anyMatch(Transaction::isTransfer));
        assertEquals(500.0, income(user, date.plusSeconds(1)));
        assertEquals(0.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void cashAppVenmo_sameAmountCoincidence_notTransfers() {
        // TEST 9 (brief) — a Cash App/Venmo P2P outflow and an unrelated
        // same-amount income must NOT pair into a false transfer, even though
        // both carry Plaid's broad TRANSFER category under the same item.
        User user = createUser();
        item("item-cav", user);
        Instant date = Instant.parse("2026-03-16T00:00:00Z");

        PlaidTransaction cashApp = new PlaidTransaction(
                "ca-v-1", "CASH APP TRANSFER", date, "Transfer", 500.0, false, "USD", null,
                "checking-1", "item-cav", "TRANSFER_OUT_THIRD_PARTY_P2P");
        PlaidTransaction deposit = new PlaidTransaction(
                "ca-v-2", "External Deposit", date, "Transfer", -500.0, false, "USD", null,
                "savings-1", "item-cav", "TRANSFER_IN_THIRD_PARTY_P2P");
        ingestService.upsertTransaction(user, cashApp);
        ingestService.upsertTransaction(user, deposit);

        List<Transaction> stored = userTransactions(user);
        assertFalse(byPlaidId(stored, "ca-v-1").isTransfer());
        assertFalse(byPlaidId(stored, "ca-v-2").isTransfer());
        assertEquals(500.0, income(user, date.plusSeconds(1)));
        assertEquals(500.0, expenses(user, date.plusSeconds(1)));

        cleanup(user);
    }

    private double income(User user, Instant to) {
        return transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, Instant.EPOCH, to);
    }

    private double expenses(User user, Instant to) {
        return transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, Instant.EPOCH, to);
    }

    private double totalBudgetSpent(User user) {
        return budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).stream()
                .mapToDouble(Budget::getSpent)
                .sum();
    }

    private Transaction byPlaidId(List<Transaction> transactions, String plaidId) {
        return transactions.stream()
                .filter(t -> plaidId.equals(t.getPlaidTransactionId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing transaction " + plaidId));
    }

    private void cleanup(User user) {
        // The NOT_SUPPORTED tests have no ambient transaction; the cleanup writes
        // (derived deletes require a transaction) run inside their own one.
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.executeWithoutResult(status -> {
            transactionRepository.deleteByUser_Id(user.getId());
            budgetRepository.deleteByUser_Id(user.getId());
            plaidItemRepository.deleteByUser_Id(user.getId());
            userRepository.deleteById(user.getId());
        });
    }
}
