import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";

export default function BankAttentionCard({ institutionName, reconnect, busy, onPress, inPill = false }: {
  institutionName: string | null;
  reconnect: boolean;
  busy: boolean;
  onPress: () => void;
  inPill?: boolean;
}) {
  const bank = institutionName || "Your bank";
  const { THEME } = useTheme();
  const actionColor = inPill ? THEME.onPrimary : "#A6E664";
  const titleColor = inPill ? THEME.onPrimary : "#FFFFFF";
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      accessibilityLabel={reconnect ? `Reconnect ${bank}` : `Refresh sync for ${bank}`}
      accessibilityHint={reconnect ? "Opens bank sign-in to resume transaction syncing" : "Retries transaction syncing"}
      style={{
        paddingHorizontal: 4,
        paddingVertical: 6,
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: hexToRgba(actionColor, 0.12),
      }}>
        <Ionicons name={reconnect ? "key-outline" : "refresh"} size={19} color={actionColor} accessible={false} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: titleColor, fontSize: 13, fontWeight: "700" }}>
          {bank}
        </Text>
        <Text style={{ color: actionColor, fontSize: 12, fontWeight: "600" }}>
          {reconnect ? "Sign in to reconnect" : "Tap to retry sync"}
        </Text>
      </View>
      {busy ? <ActivityIndicator size="small" color={actionColor} /> :
        <Ionicons name="arrow-forward" size={16} color={actionColor} accessible={false} />}
    </TouchableOpacity>
  );
}
