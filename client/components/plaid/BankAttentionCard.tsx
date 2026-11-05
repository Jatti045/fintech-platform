import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { sheetSurface } from "@/constants/ThemePalettes";
import type { IPlaidItem } from "@/types/plaid/types";

export default function BankAttentionCard({ item, reconnect, busy, onPress }: {
  item: IPlaidItem;
  reconnect: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { THEME } = useTheme();
  const bank = item.institutionName || "Your bank";
  const statusColor = reconnect ? THEME.warning : THEME.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      accessibilityLabel={reconnect ? `Reconnect ${bank}` : `Refresh sync for ${bank}`}
      style={{
        backgroundColor: sheetSurface(THEME), borderColor: statusColor,
        borderWidth: 1, borderRadius: 14, padding: 14,
        flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10,
        marginBottom: 8, shadowColor: THEME.sheetBackdrop,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2,
        shadowRadius: 12, elevation: 8,
      }}
    >
      <Ionicons name={reconnect ? "alert-circle" : "refresh"} size={24} color={statusColor} accessible={false} />
      <View style={{ flex: 1, minWidth: 140 }}>
        <Text style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: "800" }}>
          {reconnect ? `${bank} needs reconnecting` : `${bank} sync needs attention`}
        </Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 }}>
          {reconnect ? "Reconnect to resume transaction syncing." : "We’ll retry automatically, or you can refresh now."}
        </Text>
      </View>
      <View style={{ minHeight: 48, minWidth: 96, paddingHorizontal: 14,
        borderRadius: 12, backgroundColor: statusColor,
        alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator size="small" color={THEME.onPrimary} /> :
          <Text style={{ color: THEME.onPrimary, fontSize: 14, fontWeight: "800" }}>
            {reconnect ? "Reconnect" : "Refresh"}
          </Text>}
      </View>
    </TouchableOpacity>
  );
}
