import React, { useEffect } from "react";
import {
  ActivityIndicator,
  AppState,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { fetchPlaidItems } from "@/store/slices/plaidSlice";
import { usePlaidHealth } from "@/hooks/plaid/usePlaidHealth";
import { hexToRgba } from "@/utils/helper";
import type { IPlaidItem } from "@/types/plaid/types";

/**
 * Global, persistent Plaid attention banner.
 *
 * Mounted once (when the user is authenticated) so it can:
 *  - fetch item health on app launch and whenever the app returns to the
 *    foreground (Plaid webhook outcomes are picked up on the next check);
 *  - poll every 30s while any connection needs attention;
 *  - render a non-dismissible banner for connections that require
 *    re-authentication and for failed transaction syncs.
 *
 * Tapping the banners starts update-mode Plaid Link (re-auth) or a manual sync
 * (retry). There is deliberately NO dismiss action — items stay elevated until
 * their server-side health actually clears.
 */
export default function PlaidStatusBanner() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    reauthItems,
    retryableItems,
    reauthingItemId,
    syncingItemIds,
    openReauth,
    retrySync,
  } = usePlaidHealth();

  const needsAttention = reauthItems.length > 0 || retryableItems.length > 0;

  // Fetch on launch + every time the app returns to the foreground.
  useEffect(() => {
    dispatch(fetchPlaidItems());
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        dispatch(fetchPlaidItems());
      }
    });
    return () => subscription.remove();
  }, [dispatch]);

  // Poll while anything needs attention so LOGIN_REPAIRED / successful manual
  // syncs are reflected without the user having to leave/reopen the app.
  useEffect(() => {
    if (reauthItems.length === 0 && retryableItems.length === 0) return;
    const interval = setInterval(() => dispatch(fetchPlaidItems()), 30_000);
    return () => clearInterval(interval);
  }, [dispatch, reauthItems.length, retryableItems.length]);

  if (!needsAttention) return null;

  const reauthBanner = (item: IPlaidItem) => {
    const bank = item.institutionName || "Your bank";
    const isReauthing = reauthingItemId === item.id;
    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => openReauth(item)}
        disabled={isReauthing}
        accessibilityRole="button"
        accessibilityLabel={`Reconnect ${bank}`}
        style={{
          backgroundColor: hexToRgba(THEME.danger, 0.14),
          borderColor: hexToRgba(THEME.danger, 0.45),
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: hexToRgba(THEME.danger, 0.18),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name="alert-circle" size={18} color={THEME.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: THEME.danger, fontSize: 13, fontWeight: "800" }}
          >
            {bank} connection needs attention
          </Text>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 2 }}
          >
            Tap here to reconnect and keep your transactions syncing.
          </Text>
        </View>
        {isReauthing ? (
          <ActivityIndicator size="small" color={THEME.danger} />
        ) : (
          <Text
            style={{ color: THEME.danger, fontSize: 12, fontWeight: "800" }}
          >
            Reconnect
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const syncErrorBanner = (item: IPlaidItem) => {
    const bank = item.institutionName || "Your bank";
    const isSyncing = syncingItemIds.includes(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => retrySync(item)}
        disabled={isSyncing}
        accessibilityRole="button"
        accessibilityLabel={`Refresh sync for ${bank}`}
        style={{
          backgroundColor: hexToRgba(THEME.primary, 0.12),
          borderColor: hexToRgba(THEME.primary, 0.4),
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: hexToRgba(THEME.primary, 0.16),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name="refresh" size={18} color={THEME.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: THEME.primary, fontSize: 13, fontWeight: "800" }}
          >
            We had trouble syncing your {bank} transactions.
          </Text>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 2 }}
          >
            We&apos;ll retry automatically, or you can tap to refresh.
          </Text>
        </View>
        {isSyncing ? (
          <ActivityIndicator size="small" color={THEME.primary} />
        ) : (
          <Text
            style={{ color: THEME.primary, fontSize: 12, fontWeight: "800" }}
          >
            Refresh
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        zIndex: 100,
        elevation: 30,
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
      }}
    >
      {reauthItems.map(reauthBanner)}
      {retryableItems.map(syncErrorBanner)}
    </View>
  );
}
