package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fintechapp.fintech_api.model.PlaidItemStatus;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;

/** PostgreSQL-backed, coalesced work queue for Plaid transaction synchronization. */
@Service
public class PlaidSyncJobService {
    private static final Logger logger = LoggerFactory.getLogger(PlaidSyncJobService.class);
    public record JobClaim(String itemId, long claimedVersion, int attemptCount, String owner) { }
    public record JobStatus(String status, Integer attemptCount, Instant nextAttemptAt) { }

    private final JdbcTemplate jdbc;
    private final PlaidItemRepository items;

    @Value("${app.plaid.sync.job-lease-seconds:120}")
    private int leaseSeconds = 120;
    @Value("${app.plaid.sync.max-attempts:8}")
    private int maxAttempts = 8;
    @Value("${app.plaid.sync.reconcile-stale-hours:24}")
    private int staleHours = 24;

    public PlaidSyncJobService(JdbcTemplate jdbc, PlaidItemRepository items) {
        this.jdbc = jdbc;
        this.items = items;
    }

    /** Persists the request before callers acknowledge a webhook or return accepted status. */
    @Transactional
    public JobStatus requestSync(String itemId, boolean manual) {
        var item = items.findByItemId(itemId).orElse(null);
        if (item == null) return new JobStatus("REMOVED", null, null);
        if (item.getStatus() == PlaidItemStatus.REQUIRES_REAUTH) {
            return new JobStatus("ACTION_REQUIRED", null, null);
        }
        // A terminal row always records new work. Cooldowns delay its claim rather
        // than discard the event. Already queued/retrying events coalesce without
        // sliding the deadline, so a continuous webhook burst cannot starve the job.
        jdbc.update("""
                INSERT INTO plaid_sync_jobs(item_id, status, requested_version, claimed_version,
                    attempt_count, next_attempt_at, last_requested_at, updated_at)
                VALUES (?, 'QUEUED', 1, 0, 0, NOW(), NOW(), NOW())
                ON CONFLICT (item_id) DO UPDATE SET
                    requested_version = CASE
                        WHEN plaid_sync_jobs.status IN ('PROCESSING','SUCCEEDED','FAILED','ACTION_REQUIRED')
                            THEN GREATEST(plaid_sync_jobs.requested_version, plaid_sync_jobs.claimed_version + 1)
                        ELSE plaid_sync_jobs.requested_version END,
                    status = CASE
                        WHEN plaid_sync_jobs.status IN ('SUCCEEDED','FAILED','ACTION_REQUIRED') THEN 'QUEUED'
                        WHEN plaid_sync_jobs.status = 'RETRYING' AND ? THEN 'QUEUED'
                        ELSE plaid_sync_jobs.status END,
                    attempt_count = CASE
                        WHEN plaid_sync_jobs.status IN ('QUEUED','SUCCEEDED','FAILED','ACTION_REQUIRED') THEN 0
                        WHEN plaid_sync_jobs.status = 'RETRYING' AND ? THEN 0
                        ELSE plaid_sync_jobs.attempt_count END,
                    next_attempt_at = CASE
                        WHEN ? AND plaid_sync_jobs.status <> 'PROCESSING' THEN NOW()
                        WHEN plaid_sync_jobs.status = 'SUCCEEDED'
                            THEN GREATEST(NOW(), COALESCE(plaid_sync_jobs.last_success_at,
                                plaid_sync_jobs.completed_at, plaid_sync_jobs.last_requested_at) + INTERVAL '30 seconds')
                        WHEN plaid_sync_jobs.status = 'FAILED'
                            THEN GREATEST(NOW(), COALESCE(plaid_sync_jobs.completed_at,
                                plaid_sync_jobs.updated_at) + INTERVAL '5 minutes')
                        WHEN plaid_sync_jobs.status = 'ACTION_REQUIRED' THEN NOW()
                        ELSE plaid_sync_jobs.next_attempt_at END,
                    last_requested_at = GREATEST(plaid_sync_jobs.last_requested_at, NOW()),
                    updated_at = NOW()
                """, itemId, manual, manual, manual);
        return statusForItem(itemId).orElse(new JobStatus("QUEUED", 0, Instant.now()));
    }

    @Transactional
    public Optional<JobClaim> claimNext() {
        // Expired/exhausted attempts become visible terminal failures, unless a
        // newer generation was accepted while they ran. Preserve that pending work.
        jdbc.update("""
                UPDATE plaid_sync_jobs SET
                    status=CASE WHEN requested_version > claimed_version THEN 'QUEUED' ELSE 'FAILED' END,
                    attempt_count=CASE WHEN requested_version > claimed_version THEN 0 ELSE attempt_count END,
                    next_attempt_at=CASE WHEN requested_version > claimed_version
                        THEN NOW() + INTERVAL '5 minutes' ELSE next_attempt_at END,
                    lease_owner=NULL, lease_expires_at=NULL, completed_at=NOW(),
                    last_error_code='LEASE_EXHAUSTED', last_error_at=NOW(), updated_at=NOW()
                WHERE (status='PROCESSING' AND lease_expires_at <= NOW() OR status='RETRYING')
                  AND attempt_count >= ?
                """, maxAttempts);
        List<JobClaim> candidates = jdbc.query("""
                SELECT item_id, requested_version, attempt_count
                FROM plaid_sync_jobs
                WHERE (status IN ('QUEUED','RETRYING') AND next_attempt_at <= NOW()
                       OR status='PROCESSING' AND lease_expires_at <= NOW())
                  AND (status='QUEUED' OR attempt_count < ?)
                ORDER BY next_attempt_at, updated_at
                FOR UPDATE SKIP LOCKED LIMIT 1
                """, (rs, row) -> new JobClaim(rs.getString(1), rs.getLong(2), rs.getInt(3), null), maxAttempts);
        if (candidates.isEmpty()) return Optional.empty();
        JobClaim candidate = candidates.get(0);
        String owner = UUID.randomUUID().toString();
        // QUEUED starts a fresh failure budget, including rows stranded by old
        // successful follow-ups that incorrectly accumulated attempt_count.
        int updated = jdbc.update("""
                UPDATE plaid_sync_jobs SET status='PROCESSING', claimed_version=requested_version,
                    attempt_count=CASE WHEN status='QUEUED' THEN 1 ELSE attempt_count+1 END,
                    lease_owner=?, lease_expires_at=NOW() + (? * INTERVAL '1 second'),
                    started_at=NOW(), updated_at=NOW()
                WHERE item_id=?
                """, owner, Math.max(30, leaseSeconds), candidate.itemId());
        if (updated != 1) return Optional.empty();
        Integer attempt = jdbc.queryForObject("SELECT attempt_count FROM plaid_sync_jobs WHERE item_id=?", Integer.class, candidate.itemId());
        Long version = jdbc.queryForObject("SELECT claimed_version FROM plaid_sync_jobs WHERE item_id=?", Long.class, candidate.itemId());
        return Optional.of(new JobClaim(candidate.itemId(), version, attempt, owner));
    }

    @Transactional
    public boolean renew(JobClaim claim) {
        return jdbc.update("""
                UPDATE plaid_sync_jobs SET lease_expires_at=NOW() + (? * INTERVAL '1 second'), updated_at=NOW()
                WHERE item_id=? AND status='PROCESSING' AND lease_owner=? AND lease_expires_at > NOW()
                """, Math.max(30, leaseSeconds), claim.itemId(), claim.owner()) == 1;
    }

    @Transactional
    public boolean complete(JobClaim claim) {
        return jdbc.update("""
                UPDATE plaid_sync_jobs SET
                    status=CASE WHEN requested_version > claimed_version THEN 'QUEUED' ELSE 'SUCCEEDED' END,
                    attempt_count=0,
                    next_attempt_at=CASE WHEN requested_version > claimed_version
                        THEN NOW() + INTERVAL '30 seconds' ELSE NOW() END,
                    last_success_at=NOW(), completed_at=NOW(),
                    last_error_code=NULL, last_error_at=NULL, lease_owner=NULL,
                    lease_expires_at=NULL, updated_at=NOW()
                WHERE item_id=? AND status='PROCESSING' AND lease_owner=?
                """, claim.itemId(), claim.owner()) == 1;
    }

    @Transactional
    public boolean retry(JobClaim claim, String errorCode) {
        if (claim.attemptCount() >= maxAttempts) return fail(claim, "RETRY_EXHAUSTED");
        long base = Math.min(3600L, 15L * (1L << Math.min(8, claim.attemptCount() - 1)));
        long delay = base + ThreadLocalRandom.current().nextLong(Math.max(1, base / 4));
        return jdbc.update("""
                UPDATE plaid_sync_jobs SET status='RETRYING', next_attempt_at=NOW() + (? * INTERVAL '1 second'),
                    last_error_code=?, last_error_at=NOW(), lease_owner=NULL, lease_expires_at=NULL, updated_at=NOW()
                WHERE item_id=? AND status='PROCESSING' AND lease_owner=?
                """, delay, safeCode(errorCode), claim.itemId(), claim.owner()) == 1;
    }

    @Transactional
    public boolean requireAction(JobClaim claim, String errorCode) {
        items.markRequiresReauth(claim.itemId(), PlaidItemStatus.REQUIRES_REAUTH, Instant.now());
        return jdbc.update("""
                UPDATE plaid_sync_jobs SET status='ACTION_REQUIRED', last_error_code=?, last_error_at=NOW(),
                    completed_at=NOW(), lease_owner=NULL, lease_expires_at=NULL, updated_at=NOW()
                WHERE item_id=? AND status='PROCESSING' AND lease_owner=?
                """, safeCode(errorCode), claim.itemId(), claim.owner()) == 1;
    }

    @Transactional
    public boolean fail(JobClaim claim, String errorCode) {
        return jdbc.update("""
                UPDATE plaid_sync_jobs SET
                    status=CASE WHEN requested_version > claimed_version THEN 'QUEUED' ELSE 'FAILED' END,
                    attempt_count=CASE WHEN requested_version > claimed_version THEN 0 ELSE attempt_count END,
                    next_attempt_at=CASE WHEN requested_version > claimed_version
                        THEN NOW() + INTERVAL '5 minutes' ELSE next_attempt_at END,
                    last_error_code=?, last_error_at=NOW(), completed_at=NOW(),
                    lease_owner=NULL, lease_expires_at=NULL, updated_at=NOW()
                WHERE item_id=? AND status='PROCESSING' AND lease_owner=?
                """, safeCode(errorCode), claim.itemId(), claim.owner()) == 1;
    }

    public Optional<JobStatus> statusForItem(String itemId) {
        return jdbc.query("SELECT status, attempt_count, next_attempt_at FROM plaid_sync_jobs WHERE item_id=?",
                (rs, row) -> new JobStatus(rs.getString(1), (Integer) rs.getObject(2), rs.getTimestamp(3) == null ? null : rs.getTimestamp(3).toInstant()), itemId)
                .stream().findFirst();
    }

    @Transactional
    public void markActionRequired(String itemId) {
        jdbc.update("""
                INSERT INTO plaid_sync_jobs(item_id, status, requested_version, claimed_version,
                    attempt_count, next_attempt_at, last_requested_at, last_error_code, last_error_at, updated_at)
                VALUES (?, 'ACTION_REQUIRED', 1, 0, 0, NOW(), NOW(), 'ITEM_LOGIN_REQUIRED', NOW(), NOW())
                ON CONFLICT (item_id) DO UPDATE SET status='ACTION_REQUIRED',
                    last_error_code='ITEM_LOGIN_REQUIRED', last_error_at=NOW(), completed_at=NOW(),
                    lease_owner=NULL, lease_expires_at=NULL, updated_at=NOW()
                """, itemId);
    }

    /** Requeues old ACTIVE items in bounded batches; queue upsert coalesces concurrent/manual requests. */
    @Scheduled(fixedDelayString = "${app.plaid.sync.reconcile-interval-ms:900000}",
            initialDelayString = "${app.plaid.sync.reconcile-initial-delay-ms:0}")
    public void reconcileStaleItems() {
        List<String> stale = jdbc.queryForList("""
                SELECT i.item_id FROM plaid_items i
                LEFT JOIN plaid_sync_jobs j ON j.item_id=i.item_id
                WHERE i.status='ACTIVE'
                  AND (i.last_synced_at IS NULL OR i.last_synced_at < NOW() - (? * INTERVAL '1 hour'))
                  AND (j.item_id IS NULL OR j.status='SUCCEEDED')
                  AND (j.last_requested_at IS NULL OR j.last_requested_at < NOW() - INTERVAL '30 seconds')
                ORDER BY i.last_synced_at NULLS FIRST LIMIT 100
                """, String.class, Math.max(1, staleHours));
        for (String itemId : stale) requestSync(itemId, false);
        if (!stale.isEmpty()) logger.info("Plaid freshness reconciliation queued {} stale items", stale.size());
    }

    @Scheduled(fixedDelayString = "${app.plaid.sync.metrics-interval-ms:300000}",
            initialDelayString = "${app.plaid.sync.metrics-initial-delay-ms:0}")
    public void logQueueHealth() {
        List<Map<String, Object>> counts = jdbc.queryForList("""
                SELECT status, COUNT(*) AS jobs, MAX(attempt_count) AS max_attempts,
                       MIN(updated_at) AS oldest,
                       AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at,NOW())-started_at)))
                           FILTER (WHERE started_at IS NOT NULL) AS avg_processing_seconds
                FROM plaid_sync_jobs GROUP BY status ORDER BY status
                """);
        Integer stale = jdbc.queryForObject("""
                SELECT COUNT(*) FROM plaid_items WHERE status='ACTIVE'
                  AND (last_synced_at IS NULL OR last_synced_at < NOW() - (? * INTERVAL '1 hour'))
                """, Integer.class, Math.max(1, staleHours));
        logger.info("Plaid sync queue health: statuses={} stale_active_items={}", counts, stale);
    }

    private static String safeCode(String code) {
        if (code == null || code.isBlank()) return "SYNC_ERROR";
        return code.replaceAll("[^A-Za-z0-9_:-]", "_").substring(0, Math.min(128, code.length()));
    }
}
