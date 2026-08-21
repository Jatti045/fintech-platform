package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

/**
 * End-to-end tests proving the Plaid transaction persistence layer is
 * idempotent against the real database, including the unique index on
 * {@code plaid_transaction_id}. These exercise the actual
 * {@link PlaidTransactionIngestService} (no mocks), so duplicate protection is
 * verified end to end.
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
        return tx(id, null, false, name, amount, date);
    }

    private PlaidTransaction tx(String id, String pendingId, String name, double amount, Instant date) {
        return tx(id, pendingId, false, name, amount, date);
    }

    private PlaidTransaction tx(String id, String pendingId, boolean pending, String name, double amount, Instant date) {
        return new PlaidTransaction(id, pendingId, pending, name, date, "Food", amount, "USD", null);
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

        ingestService.upsertTransaction(user, tx("t-1", "STARBUCKS", 5.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("t-1", "STARBUCKS", 5.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("t-1", "STARBUCKS", 5.0, date), item.getItemId());

        List<Transaction> stored = userTransactions(user);
        assertEquals(1, stored.size());
        assertEquals("t-1", stored.get(0).getPlaidTransactionId());
    }

    @Test
    void multipleTransactionsSyncedTwice_persistsOnceEach() {
        User user = createUser();
        PlaidItem item = item("item-2", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        ingestService.upsertTransaction(user, tx("A", "STARBUCKS", 5.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("B", "UBER", 18.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("C", "CVS", 12.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("A", "STARBUCKS", 5.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("B", "UBER", 18.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("C", "CVS", 12.0, date), item.getItemId());

        assertEquals(3, userTransactions(user).size());
    }

    // ── Identical values, different ids ──────────────────────────────────────

    @Test
    void identicalTransactionsDifferentIds_sameItem_remainDistinct() {
        User user = createUser();
        PlaidItem item = item("item-3", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        // Two legitimate $5 Starbucks purchases on the same day.
        ingestService.upsertTransaction(user, tx("id-1", "STARBUCKS", 5.0, date), item.getItemId());
        ingestService.upsertTransaction(user, tx("id-2", "STARBUCKS", 5.0, date), item.getItemId());

        assertEquals(2, userTransactions(user).size());
    }

    // ── Reconnect (disconnect + reconnect = new Item, new transaction ids) ───

    @Test
    void reconnectNewItem_sameHistoricalTransactions_noDuplicates() {
        User user = createUser();
        PlaidItem oldItem = item("item-old", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        ingestService.upsertTransaction(user, tx("old-1", "STARBUCKS", 5.0, date), oldItem.getItemId());
        ingestService.upsertTransaction(user, tx("old-2", "UBER", 18.0, date), oldItem.getItemId());

        // Disconnect: the Plaid Item is removed, but historical transactions stay.
        plaidItemRepository.delete(oldItem);

        // Reconnect: a brand-new Item re-serves the same transactions under new ids.
        PlaidItem newItem = item("item-new", user);
        ingestService.upsertTransaction(user, tx("new-1", "STARBUCKS", 5.0, date), newItem.getItemId());
        ingestService.upsertTransaction(user, tx("new-2", "UBER", 18.0, date), newItem.getItemId());

        List<Transaction> stored = userTransactions(user);
        assertEquals(2, stored.size());
        // The old rows adopted the reconnected ids (fingerprint merge).
        assertEquals(2, stored.stream().filter(t -> "item-new".equals(t.getPlaidItemId())).count());
        assertTrue(stored.stream().anyMatch(t -> "new-1".equals(t.getPlaidTransactionId())));
        assertTrue(stored.stream().anyMatch(t -> "new-2".equals(t.getPlaidTransactionId())));
    }
    @Test
    void reconnectTwoIdenticalSameDay_transactions_timestampDistinguishes_oneToEach() {
        User user = createUser();
        PlaidItem oldItem = item("item-old", user);
        Instant morning = Instant.parse("2026-08-15T09:12:00Z");
        Instant evening = Instant.parse("2026-08-15T18:45:00Z");

        ingestService.upsertTransaction(user, tx("old-1", "STARBUCKS", 5.5, morning), oldItem.getItemId());
        ingestService.upsertTransaction(user, tx("old-2", "STARBUCKS", 5.5, evening), oldItem.getItemId());
        plaidItemRepository.delete(oldItem);

        // Reconnect: the same two purchases come back with new ids but the same
        // timestamps — each must merge into a DIFFERENT existing row.
        PlaidItem newItem = item("item-new", user);
        ingestService.upsertTransaction(user, tx("new-1", "STARBUCKS", 5.5, morning), newItem.getItemId());
        ingestService.upsertTransaction(user, tx("new-2", "STARBUCKS", 5.5, evening), newItem.getItemId());

        List<Transaction> stored = userTransactions(user);
        assertEquals(2, stored.size());
        assertTrue(stored.stream().anyMatch(t -> "new-1".equals(t.getPlaidTransactionId())));
        assertTrue(stored.stream().anyMatch(t -> "new-2".equals(t.getPlaidTransactionId())));
        assertEquals(2, stored.stream().filter(t -> "item-new".equals(t.getPlaidItemId())).count());
    }

    @Test
    void reconnectClosestTimestampIsNotEvidence_ambiguous_doesNotMerge() {
        User user = createUser();
        PlaidItem oldItem = item("item-old", user);

        ingestService.upsertTransaction(
                user, tx("old-1", "STARBUCKS", 5.5, Instant.parse("2026-08-15T10:00:00Z")), oldItem.getItemId());
        ingestService.upsertTransaction(
                user, tx("old-2", "STARBUCKS", 5.5, Instant.parse("2026-08-15T10:30:00Z")), oldItem.getItemId());
        plaidItemRepository.delete(oldItem);

        // A reconnected 10:20 record is "closest" to the 10:30 purchase (10 min)
        // but matches neither timestamp exactly. Proximity is NOT evidence, so
        // the transaction must be inserted rather than merged.
        PlaidItem newItem = item("item-new", user);
        ingestService.upsertTransaction(
                user, tx("new-1", "STARBUCKS", 5.5, Instant.parse("2026-08-15T10:20:00Z")), newItem.getItemId());

        assertEquals(3, userTransactions(user).size()); // 2 old + 1 new; nothing merged
    }

    @Test
    void reconnectTwoIdenticalSameDay_noTimestamps_ambiguous_doesNotMerge() {
        User user = createUser();
        PlaidItem oldItem = item("item-old", user);
        Instant midnight = Instant.parse("2026-08-15T00:00:00Z");

        ingestService.upsertTransaction(user, tx("old-1", "STARBUCKS", 5.5, midnight), oldItem.getItemId());
        ingestService.upsertTransaction(user, tx("old-2", "STARBUCKS", 5.5, midnight), oldItem.getItemId());
        plaidItemRepository.delete(oldItem);

        // Without a Plaid timestamp the two purchases are indistinguishable, so
        // the reconnect must NOT merge either of them (no silent corruption).
        PlaidItem newItem = item("item-new", user);
        ingestService.upsertTransaction(user, tx("new-1", "STARBUCKS", 5.5, midnight), newItem.getItemId());
        ingestService.upsertTransaction(user, tx("new-2", "STARBUCKS", 5.5, midnight), newItem.getItemId());

        // 2 old rows + 2 newly inserted rows; nothing was falsely merged.
        assertEquals(4, userTransactions(user).size());
    }

    @Test
    void threeIdenticalSameDay_persistsAsThree() {
        User user = createUser();
        PlaidItem item = item("item-3x", user);

        ingestService.upsertTransaction(
                user, tx("a-1", "STARBUCKS", 5.5, Instant.parse("2026-08-15T09:00:00Z")), item.getItemId());
        ingestService.upsertTransaction(
                user, tx("a-2", "STARBUCKS", 5.5, Instant.parse("2026-08-15T13:00:00Z")), item.getItemId());
        ingestService.upsertTransaction(
                user, tx("a-3", "STARBUCKS", 5.5, Instant.parse("2026-08-15T18:00:00Z")), item.getItemId());

        assertEquals(3, userTransactions(user).size());
    }



    // ── Pending → posted ─────────────────────────────────────────────────────

    @Test
    void pendingThenPosted_reconcilesToOne() {
        User user = createUser();
        PlaidItem item = item("item-4", user);
        Instant date = Instant.parse("2026-01-10T00:00:00Z");

        ingestService.upsertTransaction(user, tx("pend-1", "STARBUCKS", 5.0, date), item.getItemId());
        // The posted transaction references the pending transaction via pending_transaction_id.
        ingestService.upsertTransaction(
                user, tx("post-1", "pend-1", "STARBUCKS", 5.0, date), item.getItemId());

        List<Transaction> stored = userTransactions(user);
        assertEquals(1, stored.size());
        assertEquals("post-1", stored.get(0).getPlaidTransactionId());
        assertEquals("pend-1", stored.get(0).getPlaidPendingTransactionId());
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
                    ingestService.upsertTransaction(user, plaidTx, item.getItemId());
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

