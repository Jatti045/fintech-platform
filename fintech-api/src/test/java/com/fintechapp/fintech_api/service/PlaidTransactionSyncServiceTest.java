package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService.SyncPageResult;

@ExtendWith(MockitoExtension.class)
class PlaidTransactionSyncServiceTest {

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private PlaidService plaidService;

    @Mock
    private PlaidSyncLockService syncLockService;

    private PlaidTransactionSyncService service;

    private PlaidItem item;

    @BeforeEach
    void setUp() {
        service = new PlaidTransactionSyncService(plaidItemRepository, plaidService, syncLockService);
        User user = new User();
        user.setId("user-1");
        item = new PlaidItem();
        item.setItemId("item-1");
        item.setUser(user);
    }

    private void stubItem() {
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(syncLockService.acquireWithTimeout(any(), any(), any(), any())).thenReturn(true);
    }

    // ── Regression: injected lock service must be used, never `new
    // PlaidSyncLockService(...)` ─

    /**
     * Regression test for the production TransactionRequiredException.
     *
     * <p>
     * The original bug: {@link PlaidTransactionSyncService} had a two-arg
     * constructor that delegated to
     * {@code new PlaidSyncLockService(plaidItemRepository)}, creating a raw POJO
     * instead of the Spring-managed proxy. Spring's {@code @Transactional}
     * advice is applied only by the proxy, so the
     * {@code @Transactional(REQUIRES_NEW)}
     * on {@code PlaidSyncLockService.tryAcquire} was silently skipped, and
     * Hibernate
     * threw {@code TransactionRequiredException} on the {@code @Modifying} JPQL
     * update the moment {@code syncItemAsync} ran on the async thread.
     *
     * <p>
     * The fix removes the two-arg constructor entirely, leaving only the
     * three-arg {@code @Autowired} constructor so Spring always injects the proxy.
     *
     * <p>
     * This test verifies the invariant: the {@link PlaidSyncLockService} instance
     * that was passed in during construction is the <em>exact same object</em> that
     * {@code syncItemAsync} invokes when acquiring the lock. If the two-arg
     * constructor were to return, it would create a different (raw) instance, and
     * the mock's {@code acquireWithTimeout} stub would never fire — causing the
     * test to hang or fail with a timeout.
     */
    @Test
    void syncItemAsync_usesInjectedLockService_notRawNewInstance() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", false));

        service.syncItemAsync("item-1");

        // If the fix is absent (two-arg constructor re-instantiating via `new`),
        // the injected mock's acquireWithTimeout would never be called and
        // fetchAndApplySyncPage would not be reached at all because the raw
        // instance's tryAcquire would throw TransactionRequiredException first.
        verify(syncLockService).acquireWithTimeout(eq("item-1"), any(), any(), any());
        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
    }

    @Test
    void syncItemAsync_itemNotFound_skipsSync() {
        when(plaidItemRepository.findByItemId("missing")).thenReturn(Optional.empty());
        service.syncItemAsync("missing");
        verify(plaidService, never()).fetchAndApplySyncPage(any());
    }

    // ── Single page ──────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_singlePage_noMore_returnsAfterOneFetch() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
    }

    // ── Multi-page cursor loop (Steps B–F) ───────────────────────────────────

    @Test
    void syncItemAsync_multiPage_loopsUntilHasMoreFalse() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", true))
                .thenReturn(new SyncPageResult("cursor-2", true))
                .thenReturn(new SyncPageResult("cursor-3", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(3)).fetchAndApplySyncPage("item-1");
    }

    // ── Zero-update pages still advance until has_more=false ─────────────────

    @Test
    void syncItemAsync_zeroUpdates_stillLoopsUntilNoMore() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("c1", true))
                .thenReturn(new SyncPageResult("c2", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(2)).fetchAndApplySyncPage("item-1");
    }

    // ── Max page cap ─────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_hasMoreAlwaysTrue_stopsAtPageCap() {
        stubItem();
        // Always return hasMore=true; the guard must cap the loop.
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-x", true));

        service.syncItemAsync("item-1");

        // 50 is the hard cap (MAX_PAGES_PER_RUN) — must not loop forever.
        verify(plaidService, times(50)).fetchAndApplySyncPage("item-1");
    }

    // ── Per-item lock: a concurrent second run skips immediately ─────────────

    /**
     * Regression for the production "Timed out waiting 30000ms for local Plaid
     * item lock" warning. Duplicate Plaid webhooks ({@code SYNC_UPDATES_AVAILABLE}
     * + {@code DEFAULT_UPDATE}) dispatch two async syncs for the same item; the
     * second used to park one of only four {@code plaid-sync-*} executor
     * threads for the full 30s {@code tryLock} timeout before skipping. The
     * local lock is now non-blocking: the duplicate run must return
     * immediately, without calling /transactions/sync or the distributed lease.
     */
    @Test
    void syncItemAsync_secondConcurrentRunForSameItem_skipsImmediately() throws Exception {
        stubItem();
        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        AtomicInteger fetchCount = new AtomicInteger();

        when(plaidService.fetchAndApplySyncPage("item-1")).thenAnswer(inv -> {
            fetchCount.incrementAndGet();
            firstEntered.countDown();
            releaseFirst.await(5, TimeUnit.SECONDS);
            return new SyncPageResult("cursor-1", false);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> service.syncItemAsync("item-1"));
            assertTrue(firstEntered.await(5, TimeUnit.SECONDS), "first sync did not start");

            // The duplicate run must give up immediately instead of waiting.
            long secondStart = System.currentTimeMillis();
            Future<?> second = pool.submit(() -> service.syncItemAsync("item-1"));
            second.get(5, TimeUnit.SECONDS);
            long elapsedMs = System.currentTimeMillis() - secondStart;

            assertTrue(elapsedMs < 2000,
                    "duplicate run waited " + elapsedMs + "ms on the local lock instead of skipping");
            assertEquals(1, fetchCount.get(), "skipped run must not call /transactions/sync");
            // The skipped run must not even attempt the distributed lease.
            verify(syncLockService, times(1)).acquireWithTimeout(eq("item-1"), any(), any(), any());
        } finally {
            releaseFirst.countDown();
            pool.shutdownNow();
        }

        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
    }

    // ── Lock release: a fresh run must succeed after a long-running one ───────

    /**
     * The local lock must be fully released when a sync finishes (including a
     * long-running one): a fresh run for the same item must acquire it and
     * run to completion afterwards. Guards against any lock leak in the
     * release path — a leaked lock would leave this item permanently
     * unsyncable in this JVM.
     */
    @Test
    void syncItemAsync_afterFirstRunReleases_freshRunSucceeds() throws Exception {
        stubItem();
        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        AtomicInteger fetchCount = new AtomicInteger();

        when(plaidService.fetchAndApplySyncPage("item-1")).thenAnswer(inv -> {
            fetchCount.incrementAndGet();
            firstEntered.countDown();
            releaseFirst.await(5, TimeUnit.SECONDS);
            return new SyncPageResult("cursor-1", false);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = pool.submit(() -> service.syncItemAsync("item-1"));
            assertTrue(firstEntered.await(5, TimeUnit.SECONDS), "first sync did not start");
            releaseFirst.countDown();
            first.get(5, TimeUnit.SECONDS); // completes; lock released via finally

            // A fresh run must not be blocked by a leaked local lock.
            service.syncItemAsync("item-1");

            assertEquals(2, fetchCount.get(), "fresh sync after the first released the lock must run");
            verify(syncLockService, times(2)).release(eq("item-1"), any());
        } finally {
            releaseFirst.countDown();
            pool.shutdownNow();
        }
    }

    // ── Skip log must identify the lock owner thread ──────────────────────────

    /**
     * Operators must be able to answer "who holds the local lock?" from the
     * skip log alone. {@link ReentrantLock#toString()} reports the owning
     * thread ("[Locked by thread ...]"); the skip message must include it.
     */
    @Test
    void syncItemAsync_skipLog_includesLockOwnerThread() throws Exception {
        stubItem();
        ch.qos.logback.classic.Logger syncLogger =
                (ch.qos.logback.classic.Logger) LoggerFactory.getLogger(PlaidTransactionSyncService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        syncLogger.addAppender(appender);

        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        when(plaidService.fetchAndApplySyncPage("item-1")).thenAnswer(inv -> {
            firstEntered.countDown();
            releaseFirst.await(5, TimeUnit.SECONDS);
            return new SyncPageResult("cursor-1", false);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> service.syncItemAsync("item-1"));
            assertTrue(firstEntered.await(5, TimeUnit.SECONDS), "first sync did not start");

            pool.submit(() -> service.syncItemAsync("item-1")).get(5, TimeUnit.SECONDS);

            String skipMessages = appender.list.stream()
                    .map(ILoggingEvent::getFormattedMessage)
                    .filter(msg -> msg.contains("already held") && msg.contains("item-1"))
                    .collect(Collectors.joining("\n"));
            assertTrue(skipMessages.contains("[Locked by thread"),
                    "skip log must report the owning thread, got: " + skipMessages);
        } finally {
            releaseFirst.countDown();
            pool.shutdownNow();
            syncLogger.detachAppender(appender);
        }
    }

    // ── Distributed lock timeout ─────────────────────────────────────────────

    /**
     * When the distributed lease cannot be acquired, the run must skip AND
     * release the local lock it took first — otherwise a failed run would
     * block every later same-JVM sync for this item.
     */
    @Test
    void syncItemAsync_distributedLockFails_skipsSyncAndReleasesLocalLock() {
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(syncLockService.acquireWithTimeout(any(), any(), any(), any())).thenReturn(false);

        service.syncItemAsync("item-1");

        verify(plaidService, never()).fetchAndApplySyncPage(any());
        verify(syncLockService, never()).release(any(), any());

        // Once the distributed lease becomes available, a later run must
        // succeed instead of being blocked by a leaked local lock.
        when(syncLockService.acquireWithTimeout(any(), any(), any(), any())).thenReturn(true);
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
        verify(syncLockService, times(1)).release(eq("item-1"), any());
    }

    // ── Lock cleanup on exception ────────────────────────────────────────────

    @Test
    void syncItemAsync_syncThrowsException_releasesLockAndMarksError() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1")).thenThrow(new RuntimeException("Plaid error"));

        service.syncItemAsync("item-1");

        verify(syncLockService).release(eq("item-1"), any());
        assertTrue(item.isSyncError());
        verify(plaidItemRepository).save(item);
    }

    // ── Multi-page lease extension ───────────────────────────────────────────

    @Test
    void syncItemAsync_multiPage_extendsLockLease() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", true))
                .thenReturn(new SyncPageResult("cursor-2", false));

        service.syncItemAsync("item-1");

        verify(syncLockService, times(1)).extend(eq("item-1"), any(), any());
        verify(syncLockService, times(1)).release(eq("item-1"), any());
    }

    // ── Different items must not serialize on each other's locks ─────────────

    /**
     * The local lock is per {@code item_id}: two syncs for different items
     * must be able to hold their locks at the same time (proven here by both
     * being inside their blocked fetch calls simultaneously).
     */
    @Test
    void syncItemAsync_differentItems_runConcurrently() throws Exception {
        PlaidItem item2 = new PlaidItem();
        item2.setItemId("item-2");
        item2.setUser(item.getUser());
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(plaidItemRepository.findByItemId("item-2")).thenReturn(Optional.of(item2));
        when(syncLockService.acquireWithTimeout(any(), any(), any(), any())).thenReturn(true);

        CountDownLatch item1Entered = new CountDownLatch(1);
        CountDownLatch item2Entered = new CountDownLatch(1);
        CountDownLatch releaseBoth = new CountDownLatch(1);
        when(plaidService.fetchAndApplySyncPage(anyString())).thenAnswer(inv -> {
            String id = inv.getArgument(0);
            (id.equals("item-1") ? item1Entered : item2Entered).countDown();
            releaseBoth.await(5, TimeUnit.SECONDS);
            return new SyncPageResult("cursor", false);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> service.syncItemAsync("item-1"));
            pool.submit(() -> service.syncItemAsync("item-2"));
            assertTrue(item1Entered.await(5, TimeUnit.SECONDS), "item-1 sync did not start");
            assertTrue(item2Entered.await(5, TimeUnit.SECONDS),
                    "item-2 sync was blocked by item-1's lock");
        } finally {
            releaseBoth.countDown();
            pool.shutdown();
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS), "syncs did not finish");
        }

        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
        verify(plaidService, times(1)).fetchAndApplySyncPage("item-2");
        verify(syncLockService, times(1)).release(eq("item-1"), any());
        verify(syncLockService, times(1)).release(eq("item-2"), any());
    }
}
