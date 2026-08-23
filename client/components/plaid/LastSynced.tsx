import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/hooks/useRedux";
import { usePlaidHealth } from "@/hooks/plaid/usePlaidHealth";
import { formatRelativeTime } from "@/utils/plaidTime";

/**
 * Compact "Last synced: X ago" readout for the transactions / bank-connections
 * screens. Renders nothing when no connection has synced yet.
 */
export default function LastSynced() {
  const { THEME } = useTheme();
  const { lastSyncedAt } = usePlaidHealth();

  if (!lastSyncedAt) return null;

  const label = formatRelativeTime(lastSyncedAt);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
      <Text style={{ color: THEME.textSecondary, fontSize: 11, marginRight: 4 }}>
        Last synced:
      </Text>
      <Text style={{ color: THEME.textSecondary, fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}