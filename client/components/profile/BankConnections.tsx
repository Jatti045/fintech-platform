import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GlassPanel from "@/components/global/GlassPanel";
import { formatDate, hexToRgba } from "@/utils/helper";
import type { BankConnectionsProps } from "@/types/profile/types";

/**
 * Bank Connections — glass panel that starts the native Plaid Link flow and
 * lists every active bank connection for the user.
 *
 * Each connected item shows the institution (or a fallback label) and its
 * connection date alongside a "Disconnect" action. "linking" shows progress
 * on the connect row; "disconnectingId" shows progress on the matching row.
 */
export default function BankConnections({
  THEME,
  linking,
  onLinkBank,
  items,
  loadingItems,
  disconnectingId,
  onDisconnect,
}: BankConnectionsProps) {
  const displayName = (name: string | null) => name || "Bank account";

  return (
    <GlassPanel padding={14} radius={18} style={{ marginBottom: 12 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onLinkBank}
        disabled={linking}
        accessibilityRole="button"
        accessibilityLabel="Connect a bank account"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(THEME.primary, 0.14),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="business-outline" size={19} color={THEME.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Bank Connections
          </Text>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}
          >
            Auto-sync your transactions securely
          </Text>
        </View>

        {linking ? (
          <ActivityIndicator size="small" color={THEME.primary} />
        ) : (
          <Ionicons name="add-circle-outline" size={22} color={THEME.primary} />
        )}
      </TouchableOpacity>

      {loadingItems && items.length === 0 ? (
        <ActivityIndicator
          size="small"
          color={THEME.primary}
          style={{ paddingVertical: 10 }}
        />
      ) : items.length > 0 ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: hexToRgba(THEME.border, 0.6),
          }}
        >
          {items.map((item) => {
            const name = displayName(item.institutionName);
            const isDisconnecting = disconnectingId === item.id;
            return (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: hexToRgba(THEME.primary, 0.12),
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Ionicons name="business" size={16} color={THEME.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: THEME.textPrimary,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {name}
                  </Text>
                  <Text
                    style={{
                      color: THEME.textSecondary,
                      fontSize: 11,
                      marginTop: 1,
                    }}
                  >
                    Connected {formatDate(item.createdAt)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => onDisconnect(item)}
                  disabled={isDisconnecting}
                  accessibilityRole="button"
                  accessibilityLabel={`Disconnect ${name}`}
                  style={{
                    backgroundColor: hexToRgba(THEME.danger, 0.12),
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginLeft: 8,
                  }}
                >
                  {isDisconnecting ? (
                    <ActivityIndicator size="small" color={THEME.danger} />
                  ) : (
                    <Text
                      style={{
                        color: THEME.danger,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Disconnect
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 11,
            marginTop: 10,
            lineHeight: 15,
          }}
        >
          No banks connected yet — tap above to link your first account.
        </Text>
      )}
    </GlassPanel>
  );
}
