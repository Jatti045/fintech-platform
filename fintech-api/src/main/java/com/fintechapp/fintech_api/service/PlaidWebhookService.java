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
 */
@Service
public class PlaidWebhookService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidWebhookService.class);

    private static final String WEBHOOK_TYPE_TRANSACTIONS = "TRANSACTIONS";
    private static final String WEBHOOK_TYPE_ITEM = "ITEM";

    /**
     * Plaid TRANSACTIONS webhook codes that signal new data is available to
     * pull via {@code /transactions/sync}, or that transactions were removed
     * and the local store must be reconciled.
     */
    private static final Set<String> SYNC_TRIGGER_CODES = Set.of(
            "SYNC_UPDATES_AVAILABLE",
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
            logger.info("Ignoring non-transaction Plaid webhook type={}", webhookType);
            return;
        }

        if (!SYNC_TRIGGER_CODES.contains(webhookCode)) {
            logger.info("Ignoring non-sync transaction webhook code={}", webhookCode);
            return;
        }

        if (!StringUtils.hasText(itemId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook missing item_id");
        }

        logger.info("Dispatching async transaction sync for item_id={} code={}", itemId, webhookCode);
        syncService.syncItemAsync(itemId);
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

