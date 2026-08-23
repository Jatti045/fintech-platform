package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.model.FailedWebhook;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.PlaidItemStatus;
import com.fintechapp.fintech_api.repository.FailedWebhookRepository;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;

@ExtendWith(MockitoExtension.class)
class PlaidWebhookServiceTest {

    @Mock
    private PlaidTransactionSyncService syncService;

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private FailedWebhookRepository failedWebhookRepository;

    private PlaidWebhookService service;

    @BeforeEach
    void setUp() {
        service = new PlaidWebhookService(syncService, plaidItemRepository, failedWebhookRepository);
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

    /** ITEM error payload carrying the Plaid {@code error.error_code}. */
    private Map<String, Object> itemErrorPayload(String itemId, String errorCode) {
        Map<String, Object> p = payload("ITEM", "ERROR", itemId);
        p.put("error", Map.of("error_code", errorCode));
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

    // ── Legacy /transactions/get webhooks (except DEFAULT_UPDATE) are ignored ──

    @ParameterizedTest
    @ValueSource(strings = {"INITIAL_UPDATE", "HISTORICAL_UPDATE", "TRANSACTIONS_REMOVED"})
    void handleWebhook_legacyGetWebhookCodes_areIgnored(String code) {
        service.handleWebhook(payload("TRANSACTIONS", code, "item-42"));
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_defaultUpdate_dispatchesAsyncSync() {
        service.handleWebhook(payload("TRANSACTIONS", "DEFAULT_UPDATE", "item-42"));
        verify(syncService).syncItemAsync("item-42");
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
        service.handleWebhook(payload("TRANSACTIONS", "HISTORICAL_UPDATE", "item-1"));
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

    // ── ITEM_LOGIN_REQUIRED / LOGIN_REPAIRED item health ─────────────────────

    @Test
    void handleWebhook_itemLoginRequired_marksItemRequiresReauth() {
        PlaidItem item = new PlaidItem();
        item.setItemId("item-1");
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));

        service.handleWebhook(itemErrorPayload("item-1", "ITEM_LOGIN_REQUIRED"));

        assertEquals(PlaidItemStatus.REQUIRES_REAUTH, item.getStatus());
        assertNotNull(item.getReauthRequestedAt());
        verify(plaidItemRepository).save(item);
        verifyNoInteractions(syncService);
    }

    @Test
    void handleWebhook_itemLoginRequiredWithoutErrorObject_marksItemRequiresReauth() {
        PlaidItem item = new PlaidItem();
        item.setItemId("item-1");
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));

        // Some Plaid payloads carry the code directly on webhook_code instead of
        // inside an error object; both shapes must be handled.
        service.handleWebhook(payload("ITEM", "ITEM_LOGIN_REQUIRED", "item-1"));

        assertEquals(PlaidItemStatus.REQUIRES_REAUTH, item.getStatus());
        verify(plaidItemRepository).save(item);
    }

    @Test
    void handleWebhook_loginRepaired_clearsRequiresReauth() {
        PlaidItem item = new PlaidItem();
        item.setItemId("item-1");
        item.setStatus(PlaidItemStatus.REQUIRES_REAUTH);
        item.setReauthRequestedAt(java.time.Instant.now());
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));

        service.handleWebhook(payload("ITEM", "LOGIN_REPAIRED", "item-1"));

        assertEquals(PlaidItemStatus.ACTIVE, item.getStatus());
        assertNull(item.getReauthRequestedAt());
        verify(plaidItemRepository).save(item);
        verifyNoInteractions(syncService);
    }

    // ── Dead-lettering ────────────────────────────────────────────────────────

    @Test
    void deadLetterWebhook_persistsPayloadAndError() {
        service.deadLetterWebhook("{\"item_id\":\"item-1\",\"webhook_type\":\"ITEM\"}",
                new IllegalStateException("boom"));

        ArgumentCaptor<FailedWebhook> captor = ArgumentCaptor.forClass(FailedWebhook.class);
        verify(failedWebhookRepository).save(captor.capture());
        FailedWebhook saved = captor.getValue();
        assertEquals("item-1", saved.getItemId());
        assertEquals(IllegalStateException.class.getName(), saved.getErrorType());
        assertEquals("boom", saved.getErrorMessage());
        assertNotNull(saved.getReceivedAt());
    }
}
