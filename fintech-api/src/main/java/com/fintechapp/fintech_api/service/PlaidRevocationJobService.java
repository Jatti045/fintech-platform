package com.fintechapp.fintech_api.service;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL outbox; credentials survive local deletion and are erased only on confirmation. */
@Service
public class PlaidRevocationJobService {
    private static final Logger logger = LoggerFactory.getLogger(PlaidRevocationJobService.class);
    private final JdbcTemplate jdbc;

    public record Claim(String id, String encryptedToken, int attemptCount, String owner) {
        @Override public String toString() {
            return "PlaidRevocationClaim[id=" + id + ", attemptCount=" + attemptCount + "]";
        }
    }

    public PlaidRevocationJobService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Caller flushes items first and deletes them in this same transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public int enqueueForUser(String userId) {
        return jdbc.update("""
                INSERT INTO plaid_revocation_jobs(id, access_token_encrypted)
                SELECT id, access_token_encrypted FROM plaid_items WHERE user_id=?
                ON CONFLICT (id) DO NOTHING
                """, userId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueForItem(String id) {
        jdbc.update("""
                INSERT INTO plaid_revocation_jobs(id, access_token_encrypted)
                SELECT id, access_token_encrypted FROM plaid_items WHERE id=?
                ON CONFLICT (id) DO NOTHING
                """, id);
    }

    @Transactional
    public Optional<Claim> claimNext() {
        String owner = UUID.randomUUID().toString();
        return jdbc.query("""
                WITH candidate AS (
                    SELECT id FROM plaid_revocation_jobs
                    WHERE next_attempt_at <= NOW()
                      AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
                    ORDER BY next_attempt_at, created_at
                    FOR UPDATE SKIP LOCKED LIMIT 1
                )
                UPDATE plaid_revocation_jobs j SET lease_owner=?,
                    lease_expires_at=NOW() + INTERVAL '120 seconds',
                    attempt_count=LEAST(j.attempt_count, 1000000000)+1, updated_at=NOW()
                FROM candidate c WHERE j.id=c.id
                RETURNING j.id, j.access_token_encrypted, j.attempt_count
                """, (rs, row) -> new Claim(rs.getString(1), rs.getString(2), rs.getInt(3), owner), owner)
                .stream().findFirst();
    }

    @Transactional
    public boolean complete(Claim claim) {
        return jdbc.update("DELETE FROM plaid_revocation_jobs WHERE id=? AND lease_owner=?",
                claim.id(), claim.owner()) == 1;
    }

    /** Never abandon remote cleanup, including configuration/decryption errors requiring operator action. */
    @Transactional
    public boolean retry(Claim claim, String errorCode) {
        long base = Math.min(21600L, 30L * (1L << Math.min(10, claim.attemptCount() - 1)));
        long delay = base + ThreadLocalRandom.current().nextLong(Math.max(1, base / 4));
        return jdbc.update("""
                UPDATE plaid_revocation_jobs SET next_attempt_at=NOW() + (? * INTERVAL '1 second'),
                    lease_owner=NULL, lease_expires_at=NULL, last_error_code=?, last_error_at=NOW(), updated_at=NOW()
                WHERE id=? AND lease_owner=?
                """, delay, errorCode, claim.id(), claim.owner()) == 1;
    }

    @Scheduled(fixedDelayString = "${app.plaid.revocation.metrics-interval-ms:300000}",
            initialDelayString = "${app.plaid.revocation.initial-delay-ms:10000}")
    public void logQueueHealth() {
        var health = jdbc.queryForMap("""
                SELECT COUNT(*) AS pending, COUNT(*) FILTER (WHERE last_error_code IS NOT NULL) AS failed,
                    MAX(attempt_count) AS max_attempts, MIN(created_at) AS oldest
                FROM plaid_revocation_jobs
                """);
        logger.info("Plaid revocation queue health: {}", health);
    }
}
