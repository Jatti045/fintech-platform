import { FLOATING_TAB_BAR, getFloatingTabBarHeight } from "@/constants/appConfig";
import React, { useEffect } from "react";
import { AppState, ScrollView, View, useWindowDimensions } from "react-native";
import BankAttentionCard from "./BankAttentionCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch } from "@/hooks/useRedux";
import { fetchPlaidItems } from "@/store/slices/plaidSlice";
import { usePlaidHealth } from "@/hooks/plaid/usePlaidHealth";

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
export default function PlaidStatusBanner({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { fontScale, height } = useWindowDimensions();
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

  useEffect(() => {
    if (!needsAttention) onHeightChange?.(0);
  }, [needsAttention, onHeightChange]);

  if (!needsAttention) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: getFloatingTabBarHeight(fontScale) + FLOATING_TAB_BAR.gap * 2 + insets.bottom,
        left: insets.left,
        right: insets.right,
        zIndex: 100,
        elevation: 30,
        paddingTop: 8,
        paddingHorizontal: 12,
      }}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      accessibilityLiveRegion="polite"
      testID="bank-attention-notification"
    >
      <ScrollView style={{ maxHeight: Math.max(160, height * 0.35) }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {reauthItems.map((item) => <BankAttentionCard key={item.id} item={item} reconnect
          busy={reauthingItemId === item.id} onPress={() => openReauth(item)} />)}
        {retryableItems.map((item) => <BankAttentionCard key={item.id} item={item} reconnect={false}
          busy={syncingItemIds.includes(item.id)} onPress={() => retrySync(item)} />)}
      </ScrollView>
    </View>
  );
}
