// ─── Plaid Slice ─────────────────────────────────────────────────────────────
// Holds the user's linked Plaid items and their health (status, syncError,
// lastSyncedAt). Consumed by the global re-auth/sync-warning banners and the
// bank-connections screen. Item state is fetched from the backend rather than
// held in memory, so banner visibility stays correct across syncs/webhooks.

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { plaidAPI } from "@/api/plaid";
import type { IPlaidItem, PlaidItemStatus } from "@/types/plaid/types";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { logger } from "@/utils/logger";

export interface PlaidState {
  items: IPlaidItem[];
  isLoading: boolean;
  /** Item ids (internal ids) currently running a background sync. */
  syncingItemIds: string[];
  /** Internal item id currently mid re-auth flow, or null. */
  reauthingItemId: string | null;
  error: string | null;
  lastFetchedAt: string | null;
}

const initialState: PlaidState = {
  items: [],
  isLoading: false,
  syncingItemIds: [],
  reauthingItemId: null,
  error: null,
  lastFetchedAt: null,
};

/** Refreshes the user's linked bank connections (status, sync health). */
export const fetchPlaidItems = createAsyncThunk(
  "plaid/fetchItems",
  async (_, { rejectWithValue }) => {
    try {
      const response = await plaidAPI.fetchItems();
      return response.data.items;
    } catch (error: unknown) {
      return rejectWithValue(
        extractErrorMessage(error, "Failed to load bank connections"),
      );
    }
  },
);

/** Marks an item ACTIVE again after the user completes update mode. */
export const completeReauth = createAsyncThunk(
  "plaid/reauthComplete",
  async (itemId: string, { rejectWithValue }) => {
    try {
      const response = await plaidAPI.reauthComplete(itemId);
      if (!response.success) {
        throw new Error(response.message || "Failed to complete reauthentation");
      }
      return itemId;
    } catch (error: unknown) {
      return rejectWithValue(
        extractErrorMessage(error, "Failed to complete re-authentication"),
      );
    }
  },
);

/** Requests an on-demand transaction sync for the given item. */
export const triggerManualSync = createAsyncThunk(
  "plaid/manualSync",
  async (itemId: string, { rejectWithValue }) => {
    try {
      const response = await plaidAPI.triggerManualSync(itemId);
      if (!response.success) {
        throw new Error(response.message || "Failed to start sync");
      }
      return itemId;
    } catch (error: unknown) {
      return rejectWithValue(
        extractErrorMessage(error, "Failed to start sync"),
      );
    }
  },
);

const plaidSlice = createSlice({
  name: "plaid",
  initialState,
  reducers: {
    /** Optimistically update a single item's health fields from the client. */
    patchPlaidItem: (
      state,
      action: PayloadAction<{ id: string; patch: Partial<IPlaidItem> }>,
    ) => {
      const item = state.items.find((it) => it.id === action.payload.id);
      if (item) {
        Object.assign(item, action.payload.patch);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlaidItems.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPlaidItems.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
        state.lastFetchedAt = new Date().toISOString();
        // Drop sync markers for items no longer present (e.g. disconnected).
        state.syncingItemIds = state.syncingItemIds.filter((id) =>
          action.payload.some((it) => it.id === id),
        );
        if (state.reauthingItemId
          && !action.payload.some((it) => it.id === state.reauthingItemId)) {
          state.reauthingItemId = null;
        }
      })
      .addCase(fetchPlaidItems.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || "Failed to load bank connections";
        logger.error("plaidSlice", state.error);
      })
      .addCase(completeReauth.pending, (state, action) => {
        state.reauthingItemId = action.meta.arg ?? null;
      })
      .addCase(completeReauth.fulfilled, (state, action) => {
        state.reauthingItemId = null;
        const item = state.items.find((it) => it.id === action.payload);
        if (item) {
          item.status = "ACTIVE" as PlaidItemStatus;
          item.reauthRequestedAt = null;
        }
      })
      .addCase(completeReauth.rejected, (state) => {
        state.reauthingItemId = null;
      })
      .addCase(triggerManualSync.pending, (state, action) => {
        const id = action.meta.arg ?? null;
        if (id && !state.syncingItemIds.includes(id)) {
          state.syncingItemIds.push(id);
        }
      })
      .addCase(triggerManualSync.fulfilled, (state, action) => {
        state.syncingItemIds = state.syncingItemIds.filter(
          (id) => id !== action.payload,
        );
      })
      .addCase(triggerManualSync.rejected, (state, action) => {
        state.syncingItemIds = state.syncingItemIds.filter(
          (id) => id !== action.meta.arg,
        );
      });
  },
});

export const { patchPlaidItem } = plaidSlice.actions;
export default plaidSlice.reducer;