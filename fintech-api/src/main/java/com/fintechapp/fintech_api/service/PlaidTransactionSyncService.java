package com.fintechapp.fintech_api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService.SyncPageResult;

/**
 * Asynchronous driver for Plaid "transactions sync". Webhook handlers and the
 * immediate post-link sync both hand off to {@link #syncItemAsync(String)} so
 * the HTTP request/response cycle is never blocked by the sync work.
 */
@Service
public class PlaidTransactionSyncService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidTransactionSyncService.class);
    private static final int MAX_PAGES_PER_RUN = 50;

    private final PlaidItemRepository plaidItemRepository;
    private final PlaidService plaidService;

    public PlaidTransactionSyncService(
            PlaidItemRepository plaidItemRepository,
            PlaidService plaidService) {
        this.plaidItemRepository = plaidItemRepository;
        this.plaidService = plaidService;
    }

    /**
     * Runs the /transactions/sync cursor loop for the given Plaid item on a
     * background thread. Safe to call fire-and-forget.
     */
    @Async("plaidTaskExecutor")
    public void syncItemAsync(String itemId) {
        PlaidItem item = plaidItemRepository.findByItemId(itemId).orElse(null);
        if (item == null) {
            logger.warn("Plaid sync skipped: no item registered for item_id={}", itemId);
            return;
        }

        String cursor = item.getCursor();
        boolean hasMore = true;
        int page = 0;
        while (hasMore && page < MAX_PAGES_PER_RUN) {
            SyncPageResult result = plaidService.fetchAndApplySyncPage(item, cursor);
            cursor = result.nextCursor();
            hasMore = result.hasMore();
            page++;
        }

        logger.info("Plaid sync finished for item_id={} pages={} hasMore={}", itemId, page, hasMore);
    }
}
