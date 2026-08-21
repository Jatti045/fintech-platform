package com.fintechapp.fintech_api.service;

import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.repository.PlaidItemRepository;

/**
 * Interprets Plaid webhook payloads and hands transaction-sync work to the
 * async sync service. The caller (controller) always returns 200 OK before
 * this does any real work.
 *
 * <p>This application consumes {@code /transactions/sync}, so the only
 * transactions webhook that may trigger a sync is
 * {@code SYNC_UPDATES_AVAILABLE}. The legacy {@code /transactions/get}
 * webhooks ({@code INITIAL_UPDATE}, {@code HISTORICAL_UPDATE},
 * {@code DEFAULT_UPDATE}, {@code TRANSACTIONS_REMOVED}) are deliberately
 * ignored: Plaid delivers the same updates through
 * {@code SYNC_UPDATES_AVAILABLE}, and reacting to both would cause duplicate
 * sync runs against the same item.</p>
 */
@Service
public class PlaidWebhookService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidWebhookService.class);

    private static final String WEBHOOK_TYPE_TRANSACTIONS = "TRANSACTIONS";
    private static final String WEBHOOK_TYPE_ITEM = "ITEM";

    /**
     * The only TRANSACTIONS webhook code that triggers a sync. Plaid fires it
     * whenever anything changed on the item since the last
     * {@code /transactions/sync} call.
     */
    private static final String WEBHOOK_CODE_SYNC_UPDATES_AVAILABLE = "SYNC_UPDATES_AVAILABLE";

    /**
     * Legacy {@code /transactions/get} webhook codes. Received for
     * informational/debug purposes but never acted on: their payloads arrive
     * in the {@code added}/{@code modified}/{@code removed} arrays of a
     * {@code SYNC_UPDATES_AVAILABLE}-triggered sync instead.
     */
    private static final Set<String> LEGACY_TRANSACTIONS_WEBHOOK_CODES = Set.of(
            "INITIAL_UPDATE",
            "HISTORICAL_UPDATE",
            "DEFAULT_UPDATE",
            "TRANSACTIONS_REMOVED"
    );

    private final PlaidTransactionSyncService syncService;
    private final PlaidItemRepository plaidItemRepository;

    public PlaidWebhookService(
            PlaidTransactionSyncService syncService,
            PlaidItemRepository plaidItemRepository) {
        this.syncService = syncService;
        this.plaidItemRepository = plaidItemRepository;
    }

    public void handleWebhook(Map<String, Object> payload) {
        if (payload == null) {
            return;
        }

        String webhookType = stringValue(payload.get("webhook_type"));
        String webhookCode = stringValue(payload.get("webhook_code"));
        String itemId = stringValue(payload.get("item_id"));

        if (WEBHOOK_TYPE_ITEM.equals(webhookType)) {
            handleItemWebhook(webhookCode, itemId);
            return;
        }

        if (!WEBHOOK_TYPE_TRANSACTIONS.equals(webhookType)) {
            logger.debug("Ignoring non-transaction Plaid webhook type={}", webhookType);
            return;
        }

        if (!StringUtils.hasText(itemId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook missing item_id");
        }

        if (WEBHOOK_CODE_SYNC_UPDATES_AVAILABLE.equals(webhookCode)) {
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
    private void handleItemWebhook(String webhookCode, String itemId) {
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

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }
}

