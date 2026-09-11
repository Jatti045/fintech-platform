package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidSyncLockService;

class PlaidSyncDistributedLockIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private PlaidSyncLockService lockService;

    @Autowired
    private PlaidItemRepository plaidItemRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private PlaidItem createTestItem(String itemId, User user) {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        return txTemplate.execute(status -> {
            PlaidItem item = new PlaidItem();
            item.setItemId(itemId);
            item.setAccessTokenEncrypted("enc-" + itemId);
            item.setUser(user);
            return plaidItemRepository.save(item);
        });
    }

    private void cleanup(User user) {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.executeWithoutResult(status -> {
            plaidItemRepository.deleteByUser_Id(user.getId());
            userRepository.deleteById(user.getId());
        });
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void distributedLock_coordinatesAcrossExecutionContexts() throws Exception {
        User user = createUser("lock-test@example.com", "Password123!", "LockTestUser");
        String itemId = "item-dist-lock-1";
        createTestItem(itemId, user);

        try {
            String token1 = "instance-1-token";
            String token2 = "instance-2-token";

            // Instance 1 acquires the lock
            boolean acq1 = lockService.tryAcquire(itemId, token1, Duration.ofSeconds(30));
            assertTrue(acq1, "Instance 1 must acquire the distributed lease");

            // Instance 2 fails to acquire while Instance 1 holds it
            boolean acq2 = lockService.tryAcquire(itemId, token2, Duration.ofSeconds(30));
            assertFalse(acq2, "Instance 2 must not acquire the distributed lease while held by Instance 1");

            // Instance 2 cannot release Instance 1's lock
            boolean relWrongToken = lockService.release(itemId, token2);
            assertFalse(relWrongToken, "Releasing with wrong token must fail");

            // Instance 1 releases the lock
            boolean rel1 = lockService.release(itemId, token1);
            assertTrue(rel1, "Instance 1 must release its distributed lease");

            // Instance 2 can now acquire the lock
            boolean acq2AfterRelease = lockService.tryAcquire(itemId, token2, Duration.ofSeconds(30));
            assertTrue(acq2AfterRelease, "Instance 2 must acquire the distributed lease after Instance 1 released it");

            lockService.release(itemId, token2);
        } finally {
            cleanup(user);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void distributedLock_expiresAndAllowsTakeoverAfterCrash() throws Exception {
        User user = createUser("crash-test@example.com", "Password123!", "CrashTestUser");
        String itemId = "item-crash-recovery";
        createTestItem(itemId, user);

        try {
            String crashingInstanceToken = "crashed-instance-token";
            String recoveringInstanceToken = "recovering-instance-token";

            // Instance 1 acquires with very short lease (1 second) and crashes (no
            // release() called)
            boolean acq1 = lockService.tryAcquire(itemId, crashingInstanceToken, Duration.ofSeconds(1));
            assertTrue(acq1);

            // Wait 1.5 seconds for lease to expire
            Thread.sleep(1500);

            // Instance 2 must be able to acquire the expired lease automatically
            boolean acq2 = lockService.tryAcquire(itemId, recoveringInstanceToken, Duration.ofSeconds(30));
            assertTrue(acq2, "Recovering instance must acquire expired lease without operator intervention");

            lockService.release(itemId, recoveringInstanceToken);
        } finally {
            cleanup(user);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void distributedLock_concurrentThreadsCompeteForLease() throws Exception {
        User user = createUser("race-test@example.com", "Password123!", "RaceTestUser");
        String itemId = "item-race-condition";
        createTestItem(itemId, user);

        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(2);
        AtomicBoolean thread1Won = new AtomicBoolean(false);
        AtomicBoolean thread2Won = new AtomicBoolean(false);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> {
                try {
                    startSignal.await(5, TimeUnit.SECONDS);
                    thread1Won.set(lockService.tryAcquire(itemId, "thread-1", Duration.ofSeconds(10)));
                } catch (Exception ignored) {
                } finally {
                    doneSignal.countDown();
                }
            });

            pool.submit(() -> {
                try {
                    startSignal.await(5, TimeUnit.SECONDS);
                    thread2Won.set(lockService.tryAcquire(itemId, "thread-2", Duration.ofSeconds(10)));
                } catch (Exception ignored) {
                } finally {
                    doneSignal.countDown();
                }
            });

            startSignal.countDown();
            assertTrue(doneSignal.await(5, TimeUnit.SECONDS));

            // Exactly ONE thread must have won the lease
            assertTrue(thread1Won.get() ^ thread2Won.get(),
                    "Exactly one thread must acquire the distributed lease");

            String winnerToken = thread1Won.get() ? "thread-1" : "thread-2";
            lockService.release(itemId, winnerToken);
        } finally {
            pool.shutdownNow();
            cleanup(user);
        }
    }

    // ── Regression: acquireWithTimeout must run the lease update inside a tx ──

    /**
     * Regression for the production {@code TransactionRequiredException: No
     * active transaction for update or delete query} raised from
     * {@code PlaidItemRepository.acquireSyncLock}.
     *
     * <p>
     * The production failure path is exactly
     * {@code syncItemAsync() -> acquireItemLock() -> acquireWithTimeout() ->
     * tryAcquire() -> acquireSyncLock()}. The existing integration tests call
     * {@code tryAcquire}/{@code release} directly through the Spring proxy, so
     * the {@code @Transactional} advice applies and they pass. But
     * {@code acquireWithTimeout} invoked {@code tryAcquire} through
     * {@code this} — self-invocation — which bypasses the CGLIB proxy and its
     * {@code @Transactional(REQUIRES_NEW)} advice. The {@code @Modifying} JPQL
     * update then executed with no active transaction.
     *
     * <p>
     * This test follows the production entry point
     * {@link PlaidSyncLockService#acquireWithTimeout} against the real
     * PostgreSQL datasource and fails with {@code TransactionRequiredException}
     * if the transaction boundary is bypassed again.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void acquireWithTimeout_executesLeaseUpdateInsideActiveTransaction() {
        User user = createUser("timeout-tx@example.com", "Password123!", "TimeoutTxUser");
        String itemId = "item-acquire-timeout-tx";
        createTestItem(itemId, user);

        try {
            // Production call path: the polling loop's first attempt.
            boolean acquired = lockService.acquireWithTimeout(itemId, "timeout-tx-token",
                    Duration.ofSeconds(2), Duration.ofSeconds(30));

            assertTrue(acquired, "acquireWithTimeout must acquire the lease "
                    + "with the lease update running inside an active transaction");
        } finally {
            lockService.release(itemId, "timeout-tx-token");
            cleanup(user);
        }
    }

    /**
     * The polling path of {@code acquireWithTimeout} must also survive real
     * transactions: when the lease is held by another owner, every retry runs
     * its own short transaction, and the run must give up cleanly at the
     * deadline (each failed attempt is a {@code @Modifying} query that needs an
     * active transaction).
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void acquireWithTimeout_pollingRetries_runInOwnTransactionsAndTimeOutCleanly() {
        User user = createUser("polling-tx@example.com", "Password123!", "PollingTxUser");
        String itemId = "item-polling-tx";
        createTestItem(itemId, user);

        try {
            assertTrue(lockService.tryAcquire(itemId, "holder-token", Duration.ofSeconds(30)));

            // Another owner holds the lease: acquisition must poll (each poll
            // executing the modifying query in its own transaction) and then
            // time out instead of throwing TransactionRequiredException.
            boolean acquired = lockService.acquireWithTimeout(itemId, "contender-token",
                    Duration.ofMillis(600), Duration.ofSeconds(30));

            assertFalse(acquired, "Acquisition must time out while another token holds the lease");
        } finally {
            lockService.release(itemId, "holder-token");
            cleanup(user);
        }
    }

    /**
     * The async sync path runs on a bare executor thread: no HTTP request, no
     * {@code OpenSessionInView} (it is disabled), no inherited transaction. The
     * lease update must succeed purely on its own {@code REQUIRES_NEW}
     * transaction, exactly like on the {@code plaid-sync-*} threads.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void acquireWithTimeout_fromAsyncThreadWithoutInheritedTransaction_acquiresLease() throws Exception {
        User user = createUser("async-tx@example.com", "Password123!", "AsyncTxUser");
        String itemId = "item-async-tx";
        createTestItem(itemId, user);

        ExecutorService bareThread = Executors.newSingleThreadExecutor();
        try {
            // A raw pool thread has NO ambient transaction — the same
            // conditions as the plaidTaskExecutor sync threads.
            Future<Boolean> acquired = bareThread.submit(() ->
                    lockService.acquireWithTimeout(itemId, "async-token",
                            Duration.ofSeconds(2), Duration.ofSeconds(30)));

            assertTrue(acquired.get(10, TimeUnit.SECONDS),
                    "Lease acquisition must succeed on an async thread with no inherited transaction");
        } finally {
            bareThread.shutdownNow();
            lockService.release(itemId, "async-token");
            cleanup(user);
        }
    }

    /**
     * Verifies the {@code REQUIRES_NEW} semantics end-to-end: the lease update
     * must commit in its own transaction even when the surrounding transaction
     * rolls back.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void tryAcquire_commitsInItsOwnTransaction_independentOfOuterRollback() {
        User user = createUser("requires-new@example.com", "Password123!", "RequiresNewUser");
        String itemId = "item-requires-new";
        createTestItem(itemId, user);

        try {
            new TransactionTemplate(transactionManager).execute(status -> {
                // Outer transaction active but rolled back at the end. The
                // lease update must NOT join it.
                boolean acquired = lockService.tryAcquire(itemId, "requires-new-token",
                        Duration.ofSeconds(30));
                assertTrue(acquired);
                status.setRollbackOnly();
                return null;
            });

            // In a fresh transaction the lease must still be held by our
            // token: REQUIRES_NEW committed independently of the rollback.
            new TransactionTemplate(transactionManager).execute(status -> {
                PlaidItem fresh = plaidItemRepository.findByItemId(itemId).orElseThrow();
                assertEquals("requires-new-token", fresh.getSyncLockToken(),
                        "Lease must persist after the surrounding transaction rolled back");
                return null;
            });
        } finally {
            lockService.release(itemId, "requires-new-token");
            cleanup(user);
        }
    }
}
