// ─── usePlaidHealth ──────────────────────────────────────────────────────────
// Single source of truth for Plaid item health: reads the shared plaid slice,
// refreshes the item list, runs the update-mode (re-auth) Plaid Link flow, and
// triggers manual transaction syncs.

import { useCallback, useState } from "react";
import {
  useAppDispatch,
  useAppSelector,
} from "@/hooks/useRedux";
import {
  completeReauth,
  fetchPlaidItems,
  triggerManualSync,
} from "@/store/slices/plaidSlice";
import { plaidAPI } from "@/api/plaid";
import { useThemedAlert } from "@/utils/themedAlert";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { IPlaidItem } from "@/types/plaid/types";

export function usePlaidHealth() {
  const dispatch = useAppDispatch();
  const { showAlert } = useThemedAlert();

  const plaidState = useAppSelector((state) => state.plaid);
  const items = plaidState.items;
  const syncingItemIds = plaidState.syncingItemIds;

  /** Re-auth is in flight (update-mode Plaid Link open) for this item id. */
  const [reauthingItemId, setReauthingItemId] = useState<string | null>(null);

  /** Items whose bank session expired — drives the persistent repair banner. */
  const reauthItems = items.filter((it) => it.status === "REQUIRES_REAUTH");

  /** Items whose last sync failed — drives the retry warning. */
  const retryableItems = items.filter((it) => it.syncError);

  /** Newest successful sync across all connections (for "Last synced"). */
  const lastSyncedAt = items.reduce<string | null>((latest, item) => {
    if (!item.lastSyncedAt) return latest;
    if (latest === null || new Date(item.lastSyncedAt) > new Date(latest)) {
      return item.lastSyncedAt;
    }
    return latest;
  }, null);

  /** Pulls the current item list from the backend. */
  const refreshItems = useCallback(async () => {
    try {
      await dispatch(fetchPlaidItems());
    } catch {
      // Handled by the slice; the UI stays usable and polling will retry.
    }
  }, [dispatch]);

  /**
   * Runs the update-mode Plaid Link flow for an item that needs re-auth.
   *
   * The backend returns an update link_token that re-uses the existing
   * access_token — the access token does NOT change, so on success we simply
   * call /items/reauth-complete (which clears the flag and syncs) instead of
   * exchanging a public token.
   */
  const openReauth = useCallback(
    async (item: IPlaidItem) => {
      setReauthingItemId(item.id);
      try {
        // Lazily load the native Plaid Link SDK (mirrors the connect flow).
        let plaidModule: any;
        try {
          plaidModule = require("react-native-plaid-link-sdk");
        } catch (e: any) {
          setReauthingItemId(null);
          showAlert({
            title: "Plaid Not Available",
            message: `Reconnecting needs the native Plaid SDK in this app build. Details: ${
              e?.message || "native module missing"
            }`,
          });
          return;
        }
        const createPlaidLinkSession = plaidModule?.createPlaidLinkSession;
        if (typeof createPlaidLinkSession !== "function") {
          setReauthingItemId(null);
          showAlert({
            title: "Plaid Not Available",
            message:
              "The installed app was built without the Plaid SDK. Rebuild and reinstall the development client.",
          });
          return;
        }

        const response = await plaidAPI.createUpdateLinkToken(item.id);
        const linkToken = response?.data?.linkToken;
        if (!linkToken) {
          throw new Error("Plaid could not create an update link token.");
        }

        const handler = await createPlaidLinkSession({
          token: linkToken,
          onSuccess: async () => {
            try {
              // Update mode does NOT deliver a new access token; just clear
              // the REQUIRES_REAUTH flag (backend also kicks a transaction
              // sync) and pull fresh item health.
              await dispatch(completeReauth(item.id));
              await dispatch(fetchPlaidItems());
            } catch (e) {
              showAlert({
                title: "Reconnect Incomplete",
                message: extractErrorMessage(e, "We couldn't finish reconnecting your bank."),
              });
            } finally {
              setReauthingItemId(null);
            }
          },
          onExit: () => {
            // Keep the persistent banner visible so the user can try again.
            setReauthingItemId(null);
          },
          onEvent: () => {},
        });
        await handler.open();
      } catch (e) {
        setReauthingItemId(null);
        showAlert({
          title: "Reconnect Failed",
          message: extractErrorMessage(e, "Failed to start re-authentication."),
        });
      }
    },
    [dispatch, showAlert],
  );

  /** Manually triggers a transaction sync and refreshes health once it starts. */
  const retrySync = useCallback(
    async (item: IPlaidItem) => {
      try {
        await dispatch(triggerManualSync(item.id));
      } catch (e) {
        showAlert({
          title: "Sync Failed",
          message: extractErrorMessage(e, "We couldn't start a sync right now."),
        });
      }
    },
    [dispatch, showAlert],
  );

  return {
    items,
    reauthItems,
    retryableItems,
    syncingItemIds,
    reauthingItemId,
    lastSyncedAt,
    isLoading: plaidState.isLoading,
    error: plaidState.error,
    openReauth,
    retrySync,
    refreshItems,
  };
}