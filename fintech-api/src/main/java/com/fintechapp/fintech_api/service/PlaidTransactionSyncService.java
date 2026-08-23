package com.fintechapp.fintech_api.service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService.SyncPageResult;

/**
 * Asynchronous driver for Plaid "transactions sync". Webhook handlers and the
 * immediate post-link sync both hand off to {@link #syncItemAsync(String)} so
 * the HTTP request/response cycle is never blocked by the sync work.
 *
 * <p>Sync runs for the <em>same</em> {@code item_id} are serialized by a
 * per-item in-process lock. Plaid can fire several webhooks for one update
 * within the same second, and concurrent runs would all read the same stale
 * cursor, re-fetch the same pages, and overwrite each other's cursor writes.
 * The lock guarantees thread 2 waits until thread 1 has finished persisting
 * every page and committed {@code next_cursor}. Cross-instance serialization
 * is additionally enforced by a pessimistic row lock on {@code plaid_items}
 * taken by {@link PlaidService#fetchAndApplySyncPage(String)} for every page.</p>
 */
@Service
public class PlaidTransactionSyncService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidTransactionSyncService.class);
    private static final int MAX_PAGES_PER_RUN = 50;

    /**
     * Per-item in-process mutex, keyed by Plaid {@code item_id}. Entries are
     * intentionally never evicted: cardinality is bounded by the number of
     * distinct Plaid items seen by this process and eviction races with
     * in-flight waiters would defeat the locking guarantee.
     */
    private static final ConcurrentMap<String, ReentrantLock> ITEM_LOCKS = new ConcurrentHashMap<>();

    /**
     * How long a run waits for another sync of the same item before giving up.
     * A timed-out run is skipped; Plaid re-fires {@code SYNC_UPDATES_AVAILABLE}
     * on the next change, so no update is permanently lost.
     */
    @Value("${app.plaid.sync.item-lock-timeout-ms:30000}")
    private long itemLockTimeoutMs = 30_000L;

    private final PlaidItemRepository plaidItemRepository;
    private final PlaidService plaidService;

    public PlaidTransactionSyncService(
            PlaidItemRepository plaidItemRepository,
            PlaidService plaidService) {
        this.plaidItemRepository = plaidItemRepository;
        this.plaidService = plaidService;
    }

    /**
     * Runs the /transactions/sync cursor loop for the given Plaid item on a
     * background thread. Safe to call fire-and-forget.
     */
    @Async("plaidTaskExecutor")
    public void syncItemAsync(String itemId) {
        PlaidItem item = plaidItemRepository.findByItemId(itemId).orElse(null);
        if (item == null) {
            logger.warn("Plaid sync skipped: no item registered for item_id={}", itemId);
            return;
        }
        String userId = item.getUser().getId();

        // Step A — secure the exclusive per-item lock.
        if (!acquireItemLock(itemId)) {
            return;
        }
        try {
            boolean hasMore = true;
            int page = 0;
            while (hasMore && page < MAX_PAGES_PER_RUN) {
                // Steps B–E live in fetchAndApplySyncPage: it re-reads the
                // latest stored cursor under a pessimistic row lock, calls
                // /transactions/sync with it, applies the payload, and commits
                // next_cursor inside a single transaction.
                SyncPageResult result = plaidService.fetchAndApplySyncPage(itemId);
                hasMore = result.hasMore();
                page++;
            }
            logger.debug("Plaid sync finished for item_id={} pages={} hasMore={}", itemId, page, hasMore);
            // The full run completed without an exception — surface health for
            // the clients (per-page commits already stamped lastSyncedAt).
            clearSyncError(itemId);
        } catch (Exception ex) {
            logger.error("Plaid transaction sync failed for item_id={} user_id={}",
                    itemId, userId, ex);
            // Persisted item health — NOT an in-memory flag. The clients show a
            // non-dismissible warning and offer a manual retry.
            markSyncError(itemId);
        } finally {
            // Step F — release the lock.
            releaseItemLock(itemId);
        }
    }

    /**
     * Persists {@code syncError = true} on the item so every connected client
     * can display the "trouble syncing" warning. Never throws: the flag is
     * best-effort operator feedback on an already-failed sync.
     */
    private void markSyncError(String itemId) {
        try {
            plaidItemRepository.findByItemId(itemId).ifPresent(item -> {
                item.setSyncError(true);
                plaidItemRepository.save(item);
                logger.warn("Marked item_id={} with syncError after a failed sync", itemId);
            });
        } catch (Exception persistEx) {
            logger.error("Failed to persist syncError flag for item_id={}", itemId, persistEx);
        }
    }

    /**
     * Clears {@code syncError} after a completed sync run. Best-effort and
     * guarded exactly like {@link #markSyncError(String)}.
     */
    private void clearSyncError(String itemId) {
        try {
            plaidItemRepository.findByItemId(itemId).ifPresent(item -> {
                if (item.isSyncError()) {
                    item.setSyncError(false);
                    plaidItemRepository.save(item);
                    logger.info("Cleared syncError for item_id={} after a successful sync", itemId);
                }
            });
        } catch (Exception persistEx) {
            logger.error("Failed to clear syncError flag for item_id={}", itemId, persistEx);
        }
    }

    /**
     * @return {@code true} when this thread owns the per-item lock, {@code false}
     *         when the lock could not be obtained (timeout/interrupt) and the
     *         run must be skipped.
     */
    private boolean acquireItemLock(String itemId) {
        ReentrantLock lock = ITEM_LOCKS.computeIfAbsent(itemId, k -> new ReentrantLock());

        if (lock.tryLock()) {
            logger.info("Acquired Plaid item lock for item_id={}", itemId);
            return true;
        }

        logger.warn("Plaid item lock is held by another sync for item_id={}; waiting up to {}ms",
                itemId, itemLockTimeoutMs);
        boolean acquired;
        try {
            acquired = lock.tryLock(itemLockTimeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            logger.warn("Interrupted while waiting for Plaid item lock for item_id={}", itemId);
            return false;
        }
        if (acquired) {
            logger.warn("Acquired Plaid item lock for item_id={} after waiting for the in-progress sync", itemId);
            return true;
        }
        logger.warn("Timed out waiting {}ms for Plaid item lock for item_id={}; skipping this sync run "
                + "(Plaid re-fires SYNC_UPDATES_AVAILABLE on the next change)", itemLockTimeoutMs, itemId);
        return false;
    }

    private void releaseItemLock(String itemId) {
        ReentrantLock lock = ITEM_LOCKS.get(itemId);
        if (lock != null) {
            lock.unlock();
        }
    }
}
