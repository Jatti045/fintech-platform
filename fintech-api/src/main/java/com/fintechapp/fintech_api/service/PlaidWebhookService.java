package com.fintechapp.fintech_api.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Interprets Plaid webhook payloads and hands transaction-sync work to the
 * async sync service. The caller (controller) always returns 200 OK before
 * this does any real work.
 */

@Service
public class PlaidWebhookService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidWebhookService.class);

    private static final String WEBHOOK_TYPE_TRANSACTIONS = "TRANSACTIONS";
    private static final String WEBHOOK_CODE_SYNC_UPDATES_AVAILABLE = "SYNC_UPDATES_AVAILABLE";

    private final PlaidTransactionSyncService syncService;

    public PlaidWebhookService(PlaidTransactionSyncService syncService) {
        this.syncService = syncService;
    }

    public void handleWebhook(Map<String, Object> payload) {
        if (payload == null) {
            return;
        }

        String webhookType = stringValue(payload.get("webhook_type"));
        String webhookCode = stringValue(payload.get("webhook_code"));
        String itemId = stringValue(payload.get("item_id"));

        if (!WEBHOOK_TYPE_TRANSACTIONS.equals(webhookType)) {
            logger.debug("Ignoring non-transaction Plaid webhook type={}", webhookType);
            return;
        }

        if (!WEBHOOK_CODE_SYNC_UPDATES_AVAILABLE.equals(webhookCode)) {
            logger.debug("Ignoring non-sync transaction webhook code={}", webhookCode);
            return;
        }

        if (!StringUtils.hasText(itemId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook missing item_id");
        }

        logger.info("Dispatching async transaction sync for item_id={} code={}", itemId, webhookCode);
        syncService.syncItemAsync(itemId);
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }
}
