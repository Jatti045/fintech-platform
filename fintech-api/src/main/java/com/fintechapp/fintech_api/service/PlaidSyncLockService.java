package com.fintechapp.fintech_api.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Facade for distributed synchronization leases for Plaid items across
 * application instances.
 *
 * <p>
 * Uses atomic, conditional updates against the {@code plaid_items} table in
 * PostgreSQL. Each lease is bounded by an expiration timestamp so that if an
 * instance crashes or is killed mid-sync, the lease automatically expires
 * without permanent deadlocks. All lease mutations ({@link #tryAcquire},
 * {@link #release}, {@link #extend}) are delegated to
 * {@link PlaidSyncLeaseStore}, a dedicated Spring bean whose methods each run
 * inside a short, independent {@code REQUIRES_NEW} transaction (~1ms).
 *
 * <p>
 * <strong>Why the delegation matters:</strong> Spring's proxy-based
 * {@code @Transactional} does not apply to self-invocation. This class used to
 * carry the transactional methods itself and {@link #acquireWithTimeout} called
 * its own {@code tryAcquire} via {@code this}, silently bypassing the CGLIB
 * proxy — so the {@code @Modifying} lease update ran with no active transaction
 * and production failed with {@code TransactionRequiredException}. Delegating
 * to a separate bean guarantees every database mutation crosses a transactional
 * proxy boundary.
 * </p>
 *
 * <p>
 * Sleep pauses in {@link #acquireWithTimeout} occur outside any database
 * transaction, so zero database connections are checked out while waiting.
 * </p>
 */
@Service
public class PlaidSyncLockService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidSyncLockService.class);
    private static final long POLL_INTERVAL_MS = 200L;

    private final PlaidSyncLeaseStore leaseStore;

    public PlaidSyncLockService(PlaidSyncLeaseStore leaseStore) {
        this.leaseStore = leaseStore;
    }

    /**
     * Attempts a single atomic acquisition of the distributed sync lease for
     * {@code itemId}.
     *
     * @param itemId        the Plaid item id to lock
     * @param token         unique token identifying the caller/instance
     * @param leaseDuration how long the lease remains valid before auto-expiring
     * @return {@code true} if acquired or renewed; {@code false} if held by another
     *         active token
     */
    public boolean tryAcquire(String itemId, String token, Duration leaseDuration) {
        return leaseStore.tryAcquire(itemId, token, leaseDuration);
    }

    /**
     * Polls with backoff until the distributed lease is acquired or the timeout
     * expires. Each polling attempt runs in its own short transaction inside
     * {@link PlaidSyncLeaseStore}; the sleeps in between run with no
     * transaction or connection held.
     *
     * @param itemId        the Plaid item id to lock
     * @param token         unique token identifying the caller/instance
     * @param timeout       maximum duration to wait for the lease
     * @param leaseDuration duration of the lease once acquired
     * @return {@code true} if acquired; {@code false} if timed out or interrupted
     */
    public boolean acquireWithTimeout(String itemId, String token, Duration timeout, Duration leaseDuration) {
        if (tryAcquire(itemId, token, leaseDuration)) {
            logger.info("Acquired distributed sync lease for item_id={} token={}", itemId, token);
            return true;
        }

        long timeoutMs = timeout != null ? timeout.toMillis() : 0L;
        long deadline = System.currentTimeMillis() + timeoutMs;

        logger.warn("Distributed sync lease for item_id={} is held by another instance; waiting up to {}ms",
                itemId, timeoutMs);

        while (System.currentTimeMillis() < deadline) {
            long remaining = deadline - System.currentTimeMillis();
            long sleepTime = Math.min(remaining, POLL_INTERVAL_MS);
            if (sleepTime > 0) {
                try {
                    Thread.sleep(sleepTime);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    logger.warn("Interrupted while waiting for distributed sync lease for item_id={}", itemId);
                    return false;
                }
            }

            if (tryAcquire(itemId, token, leaseDuration)) {
                logger.warn("Acquired distributed sync lease for item_id={} token={} after waiting", itemId, token);
                return true;
            }
        }

        logger.warn("Timed out waiting {}ms for distributed sync lease for item_id={}; skipping run",
                timeoutMs, itemId);
        return false;
    }

    /**
     * Releases the distributed sync lease if the stored token matches.
     *
     * @param itemId the Plaid item id
     * @param token  the token that acquired the lease
     * @return {@code true} if released; {@code false} if not owned or already
     *         cleared
     */
    public boolean release(String itemId, String token) {
        return leaseStore.release(itemId, token);
    }

    /**
     * Extends the expiration of an active distributed sync lease if owned by
     * {@code token}.
     *
     * @param itemId        the Plaid item id
     * @param token         the token that acquired the lease
     * @param leaseDuration additional lease duration from now
     * @return {@code true} if extended; {@code false} if not owned
     */
    public boolean extend(String itemId, String token, Duration leaseDuration) {
        return leaseStore.extend(itemId, token, leaseDuration);
    }
}
