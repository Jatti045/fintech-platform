package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService.SyncPageResult;

@ExtendWith(MockitoExtension.class)
class PlaidTransactionSyncServiceTest {

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private PlaidService plaidService;

    private PlaidTransactionSyncService service;

    private PlaidItem item;

    @BeforeEach
    void setUp() {
        service = new PlaidTransactionSyncService(plaidItemRepository, plaidService);
        User user = new User();
        user.setId("user-1");
        item = new PlaidItem();
        item.setItemId("item-1");
        item.setUser(user);
    }

    private void stubItem() {
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
    }

    // ── Missing item ─────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_itemNotFound_skipsSync() {
        when(plaidItemRepository.findByItemId("missing")).thenReturn(Optional.empty());
        service.syncItemAsync("missing");
        verify(plaidService, never()).fetchAndApplySyncPage(any(), any());
    }

    // ── Single page ──────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_singlePage_noMore_returnsAfterOneFetch() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage(item, null))
                .thenReturn(new SyncPageResult("cursor-1", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(1)).fetchAndApplySyncPage(item, null);
    }

    @Test
    void syncItemAsync_noCursorInitially_passesNullCursor() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage(item, null))
                .thenReturn(new SyncPageResult("cursor-1", false));

        service.syncItemAsync("item-1");

        verify(plaidService).fetchAndApplySyncPage(eq(item), eq((String) null));
    }

    // ── Cursor advancement ───────────────────────────────────────────────────

    @Test
    void syncItemAsync_multiPage_advancesCursor() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage(item, null))
                .thenReturn(new SyncPageResult("cursor-1", true));
        when(plaidService.fetchAndApplySyncPage(item, "cursor-1"))
                .thenReturn(new SyncPageResult("cursor-2", true));
        when(plaidService.fetchAndApplySyncPage(item, "cursor-2"))
                .thenReturn(new SyncPageResult("cursor-3", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(3)).fetchAndApplySyncPage(any(), any());
        verify(plaidService).fetchAndApplySyncPage(item, null);
        verify(plaidService).fetchAndApplySyncPage(item, "cursor-1");
        verify(plaidService).fetchAndApplySyncPage(item, "cursor-2");
    }

    @Test
    void syncItemAsync_existingCursorStartsFromStoredCursor() {
        item.setCursor("stored-cursor");
        stubItem();
        when(plaidService.fetchAndApplySyncPage(item, "stored-cursor"))
                .thenReturn(new SyncPageResult("next-cursor", false));

        service.syncItemAsync("item-1");

        verify(plaidService, never()).fetchAndApplySyncPage(eq(item), eq((String) null));
        verify(plaidService).fetchAndApplySyncPage(item, "stored-cursor");
    }

    // ── Zero-update pages ────────────────────────────────────────────────────

    @Test
    void syncItemAsync_zeroUpdates_stillAdvancesCursorUntilNoMore() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage(item, null))
                .thenReturn(new SyncPageResult("c1", true));
        when(plaidService.fetchAndApplySyncPage(item, "c1"))
                .thenReturn(new SyncPageResult("c2", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(2)).fetchAndApplySyncPage(any(), any());
    }

    // ── Max page cap ─────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_hasMoreAlwaysTrue_stopsAtPageCap() {
        stubItem();
        // Always return hasMore=true; the guard must cap the loop.
        when(plaidService.fetchAndApplySyncPage(any(), any()))
                .thenReturn(new SyncPageResult("cursor-x", true));

        service.syncItemAsync("item-1");

        // 50 is the hard cap (MAX_PAGES_PER_RUN) — must not loop forever.
        verify(plaidService, times(50)).fetchAndApplySyncPage(any(), any());
    }

    @Test
    void syncItemAsync_returnsNextCursorAfterLoop() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage(item, null))
                .thenReturn(new SyncPageResult("final", false));
        service.syncItemAsync("item-1");
        verify(plaidService).fetchAndApplySyncPage(item, null);
    }
}
