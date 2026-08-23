package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.model.FailedWebhook;
import com.fintechapp.fintech_api.model.PlaidItemStatus;
import com.fintechapp.fintech_api.repository.FailedWebhookRepository;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;

/**
 * Interprets Plaid webhook payloads and hands transaction-sync work to the
 * async sync service. The caller (controller) always returns 200 OK before
 * this does any real work.
 *
 * <p>Two webhook types are meaningful here:
 *
 * <ul>
 *   <li>{@code TRANSACTIONS}/{@code SYNC_UPDATES_AVAILABLE} (and the legacy
 *       {@code DEFAULT_UPDATE} code) trigger an async /transactions/sync run.
 *       The legacy {@code /transactions/get} codes ({@code INITIAL_UPDATE},
 *       {@code HISTORICAL_UPDATE}, {@code TRANSACTIONS_REMOVED}) are ignored —
 *       the same updates arrive via {@code SYNC_UPDATES_AVAILABLE} and reacting
 *       to both would cause duplicate sync runs.</li>
 *   <li>{@code ITEM}/{@code ERROR} carrying {@code error_code =
 *       ITEM_LOGIN_REQUIRED} marks the connection {@code REQUIRES_REAUTH} so
 *       the clients can show a persistent repair banner. {@code ITEM}/
 *       {@code LOGIN_REPAIRED} clears it when the user completes update mode.</li>
 * </ul>
 *
 * <p>Any failure raises so the controller can dead-letter the raw payload and
 * still acknowledge Plaid with 200 (Plaid retries on non-200, which would
 * create retry storms).</p>
 */
@Service
public class PlaidWebhookService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidWebhookService.class);

    private static final String WEBHOOK_TYPE_TRANSACTIONS = "TRANSACTIONS";
    private static final String WEBHOOK_TYPE_ITEM = "ITEM";

    /** The current transactions webhook code that triggers a sync. */
    private static final String WEBHOOK_CODE_SYNC_UPDATES_AVAILABLE = "SYNC_UPDATES_AVAILABLE";

    /**
     * Legacy {@code /transactions/get} webhook code. Reacted to as a sync
     * trigger so the item is guaranteed fresh even while the account is on the
     * legacy endpoint.
     */
    private static final String WEBHOOK_CODE_DEFAULT_UPDATE = "DEFAULT_UPDATE";

    /**
     * {@code ITEM} error code meaning the bank session expired. Drives the
     * persistent re-auth banner in the clients.
     */
    private static final String ERROR_CODE_ITEM_LOGIN_REQUIRED = "ITEM_LOGIN_REQUIRED";

    /** {@code ITEM} code sent once the user repairs their credentials. */
    private static final String WEBHOOK_CODE_LOGIN_REPAIRED = "LOGIN_REPAIRED";

    /**
     * Legacy {@code /transactions/get} webhook codes. Received for
     * informational/debug purposes but never acted on: their payloads arrive
     * in the {@code added}/{@code modified}/{@code removed} arrays of a
     * {@code SYNC_UPDATES_AVAILABLE}-triggered sync instead.
     */
    private static final Set<String> LEGACY_TRANSACTIONS_WEBHOOK_CODES = Set.of(
            "INITIAL_UPDATE",
            "HISTORICAL_UPDATE",
            "TRANSACTIONS_REMOVED"
    );

    /** Upper bounds stored for the free-form dead-letter columns. */
    private static final int MAX_PAYLOAD_CHARS = 10_000;
    private static final int MAX_ERROR_CHARS = 1_900;
    private static final int MAX_STACK_CHARS = 8_000;

    private final PlaidTransactionSyncService syncService;
    private final PlaidItemRepository plaidItemRepository;
    private final FailedWebhookRepository failedWebhookRepository;

    public PlaidWebhookService(
            PlaidTransactionSyncService syncService,
            PlaidItemRepository plaidItemRepository,
            FailedWebhookRepository failedWebhookRepository) {
        this.syncService = syncService;
        this.plaidItemRepository = plaidItemRepository;
        this.failedWebhookRepository = failedWebhookRepository;
    }

    public void handleWebhook(Map<String, Object> payload) {
        if (payload == null) {
            return;
        }

        String webhookType = stringValue(payload.get("webhook_type"));
        String webhookCode = stringValue(payload.get("webhook_code"));
        String itemId = stringValue(payload.get("item_id"));
        String errorCode = extractErrorCode(payload);

        if (WEBHOOK_TYPE_ITEM.equals(webhookType)) {
            handleItemWebhook(webhookCode, itemId, errorCode);
            return;
        }

        if (!WEBHOOK_TYPE_TRANSACTIONS.equals(webhookType)) {
            logger.debug("Ignoring non-transaction Plaid webhook type={}", webhookType);
            return;
        }

        if (!StringUtils.hasText(itemId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook missing item_id");
        }

        if (WEBHOOK_CODE_SYNC_UPDATES_AVAILABLE.equals(webhookCode)
                || WEBHOOK_CODE_DEFAULT_UPDATE.equals(webhookCode)) {
            logger.info("Received Plaid webhook type={} code={} item_id={}; dispatching transaction sync",
                    webhookType, webhookCode, itemId);
            syncService.syncItemAsync(itemId);
            return;
        }

        if (LEGACY_TRANSACTIONS_WEBHOOK_CODES.contains(webhookCode)) {
            // High-utility receipt log so operators can confirm the duplicate
            // legacy hooks are being swallowed and not double-processing.
            logger.info("Received legacy Plaid webhook type={} code={} item_id={}; ignored because "
                    + "updates are delivered via /transactions/sync (SYNC_UPDATES_AVAILABLE)",
                    webhookType, webhookCode, itemId);
            return;
        }

        logger.debug("Ignoring unrecognized Plaid webhook type={} code={} item_id={}",
                webhookType, webhookCode, itemId);
    }

    /**
     * Handles ITEM-scoped lifecycle/error webhooks. These never trigger a
     * transaction sync. {@code USER_PERMISSION_REVOKED} means the item is gone
     * at Plaid, so the local copy is removed best-effort (matching the
     * disconnect endpoint's semantics).
     */
    private void handleItemWebhook(String webhookCode, String itemId, String errorCode) {
        if (ERROR_CODE_ITEM_LOGIN_REQUIRED.equals(errorCode)
                || ERROR_CODE_ITEM_LOGIN_REQUIRED.equals(webhookCode)) {
            logger.warn("Plaid ITEM error ITEM_LOGIN_REQUIRED for item_id={}; marking item for re-authentication",
                    itemId);
            markRequiresReauth(itemId);
            return;
        }

        if (WEBHOOK_CODE_LOGIN_REPAIRED.equals(webhookCode)) {
            logger.info("Plaid ITEM webhook LOGIN_REPAIRED for item_id={}; clearing REQUIRES_REAUTH", itemId);
            clearRequiresReauth(itemId);
            return;
        }

        if ("USER_PERMISSION_REVOKED".equals(webhookCode)) {
            logger.warn("Plaid ITEM webhook USER_PERMISSION_REVOKED for item_id={}; removing local item", itemId);
            if (StringUtils.hasText(itemId)) {
                plaidItemRepository.findByItemId(itemId).ifPresent(plaidItemRepository::delete);
            }
            return;
        }

        if ("PENDING_EXPIRATION".equals(webhookCode) || "ERROR".equals(webhookCode)) {
            logger.warn("Plaid ITEM webhook {} received for item_id={}; user may need to re-authenticate",
                    webhookCode, itemId);
            return;
        }

        logger.info("Ignoring Plaid ITEM webhook code={} item_id={}", webhookCode, itemId);
    }

    private void markRequiresReauth(String itemId) {
        if (!StringUtils.hasText(itemId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook missing item_id");
        }
        plaidItemRepository.findByItemId(itemId).ifPresentOrElse(item -> {
            item.setStatus(PlaidItemStatus.REQUIRES_REAUTH);
            item.setReauthRequestedAt(Instant.now());
            plaidItemRepository.save(item);
            logger.info("Marked item_id={} status=REQUIRES_REAUTH", itemId);
        }, () -> logger.warn("Plaid ITEM_LOGIN_REQUIRED for unknown item_id={}; no local item to update", itemId));
    }

    private void clearRequiresReauth(String itemId) {
        if (!StringUtils.hasText(itemId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook missing item_id");
        }
        plaidItemRepository.findByItemId(itemId).ifPresentOrElse(item -> {
            if (item.getStatus() == PlaidItemStatus.REQUIRES_REAUTH) {
                item.setStatus(PlaidItemStatus.ACTIVE);
                item.setReauthRequestedAt(null);
                plaidItemRepository.save(item);
                logger.info("Cleared REQUIRES_REAUTH for item_id={} after LOGIN_REPAIRED", itemId);
            }
        }, () -> logger.warn("LOGIN_REPAIRED for unknown item_id={}; nothing to clear", itemId));
    }

    /**
     * Persists an unprocessable webhook payload to the dead-letter table so an
     * operator can inspect (and replay) it. Deliberately never throws: it is
     * called from error paths and must not itself fail the request.
     */
    public void deadLetterWebhook(String rawPayload, Exception failure) {
        try {
            FailedWebhook deadLetter = new FailedWebhook();
            deadLetter.setItemId(extractItemId(rawPayload));
            deadLetter.setPayload(truncate(rawPayload, MAX_PAYLOAD_CHARS));
            if (failure != null) {
                deadLetter.setErrorType(truncate(failure.getClass().getName(), 255));
                deadLetter.setErrorMessage(truncate(failure.getMessage(), MAX_ERROR_CHARS));
                deadLetter.setStackTrace(truncate(stackTrace(failure), MAX_STACK_CHARS));
            } else {
                deadLetter.setErrorType("UnknownException");
            }
            failedWebhookRepository.save(deadLetter);
            logger.warn("Dead-lettered failed Plaid webhook (item_id={})", deadLetter.getItemId());
        } catch (Exception persistEx) {
            logger.error("Failed to persist dead-letter webhook", persistEx);
        }
    }

    /** Best-effort item_id extraction from a raw payload string. */
    private static String extractItemId(String rawPayload) {
        if (rawPayload == null) {
            return null;
        }
        String marker = "\"item_id\"";
        int start = rawPayload.indexOf(marker);
        if (start < 0) {
            return null;
        }
        int valueStart = rawPayload.indexOf('"', start + marker.length());
        if (valueStart < 0) {
            return null;
        }
        int valueEnd = rawPayload.indexOf('"', valueStart + 1);
        return valueEnd < 0 ? null : rawPayload.substring(valueStart + 1, valueEnd);
    }

    private static String stackTrace(Throwable throwable) {
        java.io.StringWriter writer = new java.io.StringWriter();
        throwable.printStackTrace(new java.io.PrintWriter(writer));
        return writer.toString();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** Extracts {@code error.error_code} (or a top-level {@code error_code}). */
    private static String extractErrorCode(Map<String, Object> payload) {
        if (payload == null) {
            return null;
        }
        Object error = payload.get("error");
        if (error instanceof Map<?, ?> errorMap) {
            Object code = errorMap.get("error_code");
            if (code != null) {
                return code.toString();
            }
        }
        Object code = payload.get("error_code");
        return code == null ? null : code.toString();
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }
}

