package com.fintechapp.fintech_api.service;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fintechapp.fintech_api.repository.PlaidItemRepository;

/**
 * Performs the individual database mutations of the Plaid sync lease
 * (acquire, release, extend) against the {@code plaid_items} table.
 *
 * <p>
 * This logic lives in a <em>dedicated</em> bean — not inside
 * {@link PlaidSyncLockService} — for a specific reason: Spring's
 * proxy-based {@code @Transactional} is silently skipped on self-invocation
 * (a method calling another method on {@code this}). Historically
 * {@code PlaidSyncLockService.acquireWithTimeout()} called its own
 * {@code @Transactional(REQUIRES_NEW) tryAcquire()} via {@code this}, which
 * bypassed the CGLIB proxy. The {@code @Modifying} JPQL lease update then ran
 * with no active transaction and Hibernate threw
 * {@code TransactionRequiredException: No active transaction for update or
 * delete query} on every sync. Routing every mutation through this bean means
 * the lock service can only reach the database via this bean's transactional
 * proxy, so the boundary is impossible to bypass by accident.
 *
 * <p>
 * Each operation executes inside a short, independent transaction (~1ms),
 * ensuring database connections are never held while waiting on locks or
 * external HTTP calls.
 * </p>
 */
@Service
public class PlaidSyncLeaseStore {

    private static final Logger logger = LoggerFactory.getLogger(PlaidSyncLeaseStore.class);

    private final PlaidItemRepository plaidItemRepository;

    public PlaidSyncLeaseStore(PlaidItemRepository plaidItemRepository) {
        this.plaidItemRepository = plaidItemRepository;
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
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryAcquire(String itemId, String token, Duration leaseDuration) {
        if (!StringUtils.hasText(itemId) || !StringUtils.hasText(token) || leaseDuration == null) {
            return false;
        }
        Instant now = Instant.now();
        Instant expiresAt = now.plus(leaseDuration);
        int updated = plaidItemRepository.acquireSyncLock(itemId, token, expiresAt, now);
        return updated > 0;
    }

    /**
     * Releases the distributed sync lease if the stored token matches.
     *
     * @param itemId the Plaid item id
     * @param token  the token that acquired the lease
     * @return {@code true} if released; {@code false} if not owned or already
     *         cleared
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean release(String itemId, String token) {
        if (!StringUtils.hasText(itemId) || !StringUtils.hasText(token)) {
            return false;
        }
        int updated = plaidItemRepository.releaseSyncLock(itemId, token);
        if (updated > 0) {
            logger.info("Released distributed sync lease for item_id={} token={}", itemId, token);
            return true;
        }
        logger.debug("Did not release distributed sync lease for item_id={} token={} (already released or expired)",
                itemId, token);
        return false;
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
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean extend(String itemId, String token, Duration leaseDuration) {
        if (!StringUtils.hasText(itemId) || !StringUtils.hasText(token) || leaseDuration == null) {
            return false;
        }
        Instant expiresAt = Instant.now().plus(leaseDuration);
        int updated = plaidItemRepository.extendSyncLock(itemId, token, expiresAt);
        return updated > 0;
    }
}