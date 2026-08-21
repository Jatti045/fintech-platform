package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;

@ExtendWith(MockitoExtension.class)
class PlaidWebhookServiceTest {

    @Mock
    private PlaidTransactionSyncService syncService;

    @Mock
    private PlaidItemRepository plaidItemRepository;

    private PlaidWebhookService service;

    @BeforeEach
    void setUp() {
        service = new PlaidWebhookService(syncService, plaidItemRepository);
    }

    private Map<String, Object> payload(String type, String code, String itemId) {
        Map<String, Object> p = new HashMap<>();
        if (type != null) {
            p.put("webhook_type", type);
        }
        if (code != null) {
            p.put("webhook_code", code);
        }
        if (itemId != null) {
            p.put("item_id", itemId);
        }
        return p;
    }

    // ── Null / malformed payloads ────────────────────────────────────────────

    @Test
    void handleWebhook_nullPayload_isNoOp() {
        service.handleWebhook(null);
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_emptyPayload_isNoOp() {
        service.handleWebhook(Map.of());
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_nullItemIdOnSyncTrigger_throwsBadRequest() {
        assertThrows(ResponseStatusException.class,
                () -> service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", null)));
    }

    @Test
    void handleWebhook_blankItemIdOnSyncTrigger_throwsBadRequest() {
        assertThrows(ResponseStatusException.class,
                () -> service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", "   ")));
    }

    // ── Non-transactions webhooks are ignored ────────────────────────────────

    @Test
    void handleWebhook_nonTransactionType_isIgnored() {
        service.handleWebhook(payload("ITEM", "WEBHOOK_UPDATE_ACKNOWLEDGED", "item-1"));
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_lowercaseType_isIgnored() {
        service.handleWebhook(payload("transactions", "SYNC_UPDATES_AVAILABLE", "item-1"));
        verifyNoInteractions(syncService);
    }

    // ── Sync trigger code dispatches async sync ───────────────────────────────

    @Test
    void handleWebhook_syncUpdatesAvailable_dispatchesAsyncSync() {
        service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", "item-42"));
        verify(syncService).syncItemAsync("item-42");
    }

    // ── Legacy /transactions/get webhooks are ignored when using sync ─────────

    @ParameterizedTest
    @ValueSource(strings = {"INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE", "TRANSACTIONS_REMOVED"})
    void handleWebhook_legacyGetWebhookCodes_areIgnored(String code) {
        service.handleWebhook(payload("TRANSACTIONS", code, "item-42"));
        verifyNoInteractions(syncService);
    }

    // ── Non-sync codes are acknowledged but not dispatched ───────────────────

    @Test
    void handleWebhook_unknownSyncCode_isIgnored() {
        service.handleWebhook(payload("TRANSACTIONS", "SOME_FUTURE_CODE", "item-1"));
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_unknownWebhookType_isIgnored() {
        service.handleWebhook(payload("UNKNOWN_TYPE", "SYNC_UPDATES_AVAILABLE", "item-1"));
        verifyNoInteractions(syncService);
    }

    // ── Repeated SYNC_UPDATES_AVAILABLE webhooks are each dispatched ─────────
    // (the sync service serializes them per item, so duplicates are safe)

    @Test
    void handleWebhook_syncAndLegacyDuplicateWebhooks_dispatchOnlyOnce() {
        service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", "item-1"));
        service.handleWebhook(payload("TRANSACTIONS", "DEFAULT_UPDATE", "item-1"));
        service.handleWebhook(payload("TRANSACTIONS", "TRANSACTIONS_REMOVED", "item-1"));
        verify(syncService, times(1)).syncItemAsync("item-1");
    }

    @Test
    void handleWebhook_twoSyncWebhooks_dispatchTwice() {
        service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", "item-1"));
        service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", "item-1"));
        verify(syncService, times(2)).syncItemAsync("item-1");
    }

    @Test
    void handleWebhook_syncTriggerMissingItemId_doesNotDispatch() {
        assertThrows(ResponseStatusException.class,
                () -> service.handleWebhook(payload("TRANSACTIONS", "SYNC_UPDATES_AVAILABLE", null)));
        verify(syncService, never()).syncItemAsync(org.mockito.ArgumentMatchers.anyString());
    }

    // ── ITEM lifecycle webhooks ─────────────────────────────────────────────

    @Test
    void handleWebhook_itemUserPermissionRevoked_deletesLocalItem() {
        PlaidItem item = new PlaidItem();
        item.setItemId("item-1");
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));

        service.handleWebhook(payload("ITEM", "USER_PERMISSION_REVOKED", "item-1"));

        verify(plaidItemRepository).delete(item);
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_itemUserPermissionRevoked_unknownItem_isNoOp() {
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.empty());

        service.handleWebhook(payload("ITEM", "USER_PERMISSION_REVOKED", "item-1"));

        verify(plaidItemRepository, never()).delete(any());
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_itemError_doesNotTriggerSync() {
        service.handleWebhook(payload("ITEM", "ERROR", "item-1"));
        verifyNoInteractions(syncService);
    }
}
