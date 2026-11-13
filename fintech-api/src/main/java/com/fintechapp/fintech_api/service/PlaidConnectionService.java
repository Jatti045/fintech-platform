package com.fintechapp.fintech_api.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@Service
public class PlaidConnectionService {
    private static final Logger logger = LoggerFactory.getLogger(PlaidConnectionService.class);

    public record Connection(PlaidItem item, PlaidSyncJobService.JobStatus sync) {}

    private record Attempt(UUID id, String owner, String state, String localItemId, boolean reserved) {}

    private final PlaidService plaid;
    private final EncryptionService encryption;
    private final PlaidItemRepository items;
    private final UserRepository users;
    private final PlaidSyncJobService sync;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public PlaidConnectionService(PlaidService plaid, EncryptionService encryption, PlaidItemRepository items,
            UserRepository users, PlaidSyncJobService sync, JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.plaid = plaid;
        this.encryption = encryption;
        this.items = items;
        this.users = users;
        this.sync = sync;
        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(manager);
    }

    @Transactional(propagation = Propagation.NEVER)
    public Connection connect(AuthenticatedUser auth, String publicToken) {
        if (auth == null || !StringUtils.hasText(auth.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        if (!StringUtils.hasText(publicToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Public token is required");
        }
        String userId = auth.userId();
        String token = publicToken.trim();
        Attempt attempt = transactions.execute(status -> reserve(userId, digest(token)));
        if (!userId.equals(attempt.owner())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This bank connection attempt is unavailable.");
        }
        if (!attempt.reserved()) return replay(attempt);

        // A one-time token is never sent again after an ambiguous provider outcome.
        String remoteId = null;
        String requestId = null;
        String encryptedToken = null;
        try {
            var response = plaid.exchangePublicToken(token);
            requestId = response.path("request_id").asString(null);
            remoteId = response.path("item_id").asString(null);
            String credential = response.path("access_token").asString(null);
            if (!StringUtils.hasText(remoteId) || !StringUtils.hasText(credential)) {
                throw new IllegalStateException("Incomplete Plaid exchange response");
            }
            encryptedToken = encryption.encrypt(credential);
            String itemId = remoteId;
            String encrypted = encryptedToken;
            return transactions.execute(status -> finish(attempt, itemId, encrypted));
        } catch (RuntimeException failure) {
            boolean cleanupQueued = recordFailure(attempt, remoteId, encryptedToken);
            // Provider IDs are support correlation data. Never log credentials or raw response bodies.
            logger.warn("Plaid connection failed attempt_id={} item_id={} request_id={} cleanup_queued={} error_type={}",
                    attempt.id(), safeId(remoteId), safeId(requestId), cleanupQueued, failure.getClass().getSimpleName());
            String message = cleanupQueued
                    ? "Bank connection could not be saved. Cleanup was scheduled. Start a new bank connection."
                    : "Bank connection could not be confirmed. Refresh your bank list or contact support with reference "
                            + attempt.id() + ".";
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
        }
    }

    private Attempt reserve(String userId, String digest) {
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        UUID id = UUID.randomUUID();
        int inserted = jdbc.update("""
                INSERT INTO plaid_connection_attempts(token_digest, attempt_id, user_id)
                VALUES (?, ?, ?) ON CONFLICT (token_digest) DO NOTHING
                """, digest, id, userId);
        return jdbc.queryForObject("""
                SELECT attempt_id, user_id, state, local_item_id FROM plaid_connection_attempts WHERE token_digest=?
                """, (rs, row) -> new Attempt(rs.getObject(1, UUID.class), rs.getString(2),
                        rs.getString(3), rs.getString(4), inserted == 1), digest);
    }

    private Connection replay(Attempt attempt) {
        if ("CONNECTED".equals(attempt.state())) {
            return items.findByIdAndUser_Id(attempt.localItemId(), attempt.owner())
                    .map(item -> new Connection(item, sync.statusForItem(item.getItemId())
                            .orElseThrow(() -> new IllegalStateException("Missing initial Plaid sync job"))))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.GONE, "Bank connection was removed."));
        }
        if ("CLEANUP_QUEUED".equals(attempt.state())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Start a new bank connection.");
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Bank connection is in progress or could not be confirmed. Retry this attempt or contact support with reference "
                        + attempt.id() + ".");
    }

    private Connection finish(Attempt attempt, String remoteId, String encryptedToken) {
        var user = users.findByIdForUpdate(attempt.owner())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        // Serialize registration and compensation for the same provider item.
        lockRemoteItem(remoteId);
        Boolean cleanupPending = jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM plaid_revocation_jobs WHERE id=?)",
                Boolean.class, cleanupId(remoteId));
        if (Boolean.TRUE.equals(cleanupPending)) throw new IllegalStateException("Plaid item cleanup is pending");
        PlaidItem item = items.findByItemId(remoteId).orElse(null);
        if (item == null) {
            item = new PlaidItem();
            item.setUser(user);
            item.setItemId(remoteId);
            item.setAccessTokenEncrypted(encryptedToken);
            item = items.saveAndFlush(item);
        } else if (!attempt.owner().equals(item.getUser().getId())) {
            throw new IllegalStateException("Plaid item already registered");
        }
        var job = sync.ensureInitialSync(remoteId);
        jdbc.update("UPDATE plaid_connection_attempts SET state='CONNECTED', local_item_id=? WHERE attempt_id=?",
                item.getId(), attempt.id());
        return new Connection(item, job);
    }

    private boolean recordFailure(Attempt attempt, String remoteId, String encryptedToken) {
        try {
            return Boolean.TRUE.equals(transactions.execute(status -> {
                boolean queued = false;
                if (StringUtils.hasText(remoteId) && StringUtils.hasText(encryptedToken)) {
                    lockRemoteItem(remoteId);
                    // The local commit may have succeeded despite a lost DB acknowledgement.
                    if (items.findByItemId(remoteId).isEmpty()) {
                        jdbc.update("""
                                INSERT INTO plaid_revocation_jobs(id, access_token_encrypted)
                                VALUES (?, ?) ON CONFLICT (id) DO NOTHING
                                """, cleanupId(remoteId), encryptedToken);
                        queued = true;
                    }
                }
                jdbc.update("""
                        UPDATE plaid_connection_attempts SET state=? WHERE attempt_id=? AND state='EXCHANGING'
                        """, queued ? "CLEANUP_QUEUED" : "UNCONFIRMED", attempt.id());
                return queued;
            }));
        } catch (RuntimeException cleanupFailure) {
            return false;
        }
    }

    private void lockRemoteItem(String remoteId) {
        jdbc.query("SELECT pg_advisory_xact_lock(1920148835, hashtext(?))", rs -> {}, remoteId);
    }

    private static String cleanupId(String remoteId) {
        return UUID.nameUUIDFromBytes(("plaid-connect-cleanup:" + remoteId).getBytes(StandardCharsets.UTF_8)).toString();
    }

    private static String safeId(String id) {
        return id != null && id.matches("[a-zA-Z0-9_-]{1,128}") ? id : "unavailable";
    }

    private static String digest(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 unavailable", unavailable);
        }
    }
}
