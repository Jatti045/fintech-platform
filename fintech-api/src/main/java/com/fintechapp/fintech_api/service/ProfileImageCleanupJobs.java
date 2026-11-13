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
import org.springframework.util.StringUtils;

@Service
public class ProfileImageCleanupJobs {
    private static final Logger logger = LoggerFactory.getLogger(ProfileImageCleanupJobs.class);
    private final JdbcTemplate jdbc;

    public ProfileImageCleanupJobs(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Claim(String publicId, UUID owner, int attempts) {
        @Override public String toString() { return "ProfileImageCleanupClaim[attempts=" + attempts + "]"; }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String publicId) {
        insert(publicId);
    }

    @Transactional
    public void enqueueUnattached(String publicId) {
        insert(publicId);
    }

    private void insert(String publicId) {
        if (StringUtils.hasText(publicId)) {
            jdbc.update("INSERT INTO profile_image_cleanup_jobs(public_id) VALUES (?) ON CONFLICT DO NOTHING", publicId);
        }
    }

    @Transactional
    public Optional<Claim> claimNext() {
        UUID owner = UUID.randomUUID();
        return jdbc.query("""
                WITH candidate AS (
                    SELECT j.public_id FROM profile_image_cleanup_jobs j
                    WHERE next_attempt_at <= NOW()
                      AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
                      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.profile_pic_public_id=j.public_id)
                    ORDER BY next_attempt_at, created_at
                    FOR UPDATE SKIP LOCKED LIMIT 1
                )
                UPDATE profile_image_cleanup_jobs j SET lease_owner=?,
                    lease_expires_at=NOW() + INTERVAL '120 seconds',
                    attempt_count=LEAST(j.attempt_count, 1000000000)+1
                FROM candidate c WHERE j.public_id=c.public_id
                RETURNING j.public_id, j.attempt_count
                """, (rs, row) -> new Claim(rs.getString(1), owner, rs.getInt(2)), owner)
                .stream().findFirst();
    }

    public boolean complete(Claim claim) {
        return jdbc.update("DELETE FROM profile_image_cleanup_jobs WHERE public_id=? AND lease_owner=?",
                claim.publicId(), claim.owner()) == 1;
    }

    public void retry(Claim claim) {
        long base = Math.min(21600, 30L << Math.min(10, claim.attempts() - 1));
        long delay = base + ThreadLocalRandom.current().nextLong(base / 4);
        jdbc.update("""
                UPDATE profile_image_cleanup_jobs SET next_attempt_at=NOW() + (? * INTERVAL '1 second'),
                    lease_owner=NULL, lease_expires_at=NULL WHERE public_id=? AND lease_owner=?
                """, delay, claim.publicId(), claim.owner());
    }

    @Scheduled(fixedDelayString = "${app.profile-cleanup.metrics-interval-ms:300000}",
            initialDelayString = "${app.profile-cleanup.initial-delay-ms:10000}")
    public void logQueueHealth() {
        logger.info("Profile image cleanup queue health: {}", jdbc.queryForMap("""
                SELECT COUNT(*) AS pending,
                    COUNT(*) FILTER (WHERE next_attempt_at <= NOW()
                        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())) AS due,
                    COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::bigint, 0) AS oldest_pending_seconds
                FROM profile_image_cleanup_jobs
                """));
    }
}
