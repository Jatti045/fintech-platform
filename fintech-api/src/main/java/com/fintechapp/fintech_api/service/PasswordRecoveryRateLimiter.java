package com.fintechapp.fintech_api.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Shared PostgreSQL buckets; no process-local counters or dependency on Redis availability. */
@Service
public class PasswordRecoveryRateLimiter {
    private final JdbcTemplate jdbc;
    public PasswordRecoveryRateLimiter(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** At most 5 issuances/account/hour and 20 requests/source/hour. */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public boolean allowRequest(String email, String source) {
        if (!consume("request-source", source, 20, 3600, 0)) throw limited();
        // Cooldown and account limits deliberately have the same public response as issuance.
        return consume("request-account", email, 5, 3600, PasswordRecoveryService.RESEND_COOLDOWN_SECONDS);
    }

    /** Both verification modes share 20 requests/account and 100/source per 15 minutes. */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void checkVerification(String email, String source) {
        if (!consume("verify-source", source, 100, 900, 0)
                || !consume("verify-account", email, 20, 900, 0)) throw limited();
    }

    private boolean consume(String scope, String identity, int limit, int seconds, int cooldown) {
        if (identity == null || identity.isBlank()) throw new IllegalArgumentException("Recovery source is required");
        String key = bucketKey(scope, identity);
        // The conflict update locks the bucket. No separate check-then-increment race.
        // Denied calls do not slide the window or extend the resend cooldown.
        // With no cooldown, permit concurrent statements regardless of arrival order.
        return !jdbc.queryForList("""
                WITH moment AS MATERIALIZED (SELECT clock_timestamp() AS captured_at)
                INSERT INTO password_recovery_limits(bucket_key, window_started_at, request_count, next_allowed_at)
                SELECT ?, captured_at, 1, captured_at + (? * INTERVAL '1 second') FROM moment WHERE TRUE
                ON CONFLICT (bucket_key) DO UPDATE SET
                    window_started_at = CASE WHEN password_recovery_limits.window_started_at <= EXCLUDED.window_started_at - (? * INTERVAL '1 second')
                        THEN EXCLUDED.window_started_at ELSE password_recovery_limits.window_started_at END,
                    request_count = CASE WHEN password_recovery_limits.window_started_at <= EXCLUDED.window_started_at - (? * INTERVAL '1 second')
                        THEN 1 ELSE password_recovery_limits.request_count + 1 END,
                    next_allowed_at = EXCLUDED.next_allowed_at
                WHERE (? = 0 OR password_recovery_limits.next_allowed_at <= EXCLUDED.window_started_at)
                  AND (password_recovery_limits.window_started_at <= EXCLUDED.window_started_at - (? * INTERVAL '1 second')
                       OR password_recovery_limits.request_count < ?)
                RETURNING bucket_key
                """, String.class, key, cooldown, seconds, seconds, cooldown, seconds, limit).isEmpty();
    }

    public static String bucketKey(String scope, String identity) {
        try {
            return scope + ":" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(identity.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    private static ResponseStatusException limited() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many recovery requests. Please try again later.");
    }

    @Scheduled(fixedDelay = 3600000, initialDelay = 3600000)
    public void removeExpiredBuckets() {
        jdbc.update("""
                DELETE FROM password_recovery_limits
                WHERE window_started_at < clock_timestamp() - INTERVAL '2 hours' AND bucket_key IN (
                    SELECT bucket_key FROM password_recovery_limits
                    WHERE window_started_at < clock_timestamp() - INTERVAL '2 hours'
                    ORDER BY window_started_at LIMIT 1000)
                """);
    }
}
