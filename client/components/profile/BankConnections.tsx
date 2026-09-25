import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatDate, hexToRgba } from "@/utils/helper";
import { formatRelativeTime } from "@/utils/plaidTime";
import { usePlaidHealth } from "@/hooks/plaid/usePlaidHealth";
import type { BankConnectionsProps } from "@/types/profile/types";
import type { IPlaidItem } from "@/types/plaid/types";

/**
 * Bank Connections — card matching the approved mockup:
 * First row: Gold bank icon, "Bank Connections", "Auto-sync your transactions securely", chevron.
 * Divider.
 * Second row: Connected bank item with subtle red "Disconnect" button.
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
  const { reauthingItemId, syncingItemIds, openReauth, retrySync } =
    usePlaidHealth();

  const reconnectRow = (item: IPlaidItem, name: string) => {
    const isReauthing = reauthingItemId === item.id;
    return (
      <TouchableOpacity
        key={`reauth-${item.id}`}
        onPress={() => openReauth(item)}
        disabled={isReauthing}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Reconnect ${name}`}
        style={{
          backgroundColor: "rgba(248, 113, 113, 0.12)",
          borderColor: "rgba(248, 113, 113, 0.35)",
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-circle" size={15} color="#F87171" />
        <Text
          style={{
            color: "#F87171",
            fontSize: 12,
            fontWeight: "700",
            marginLeft: 6,
            flex: 1,
          }}
        >
          {name} needs re-authentication — tap to reconnect
        </Text>
        {isReauthing ? (
          <ActivityIndicator size="small" color="#F87171" />
        ) : (
          <Text style={{ color: "#F87171", fontSize: 12, fontWeight: "800" }}>
            Reconnect
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const syncErrorRow = (item: IPlaidItem, name: string) => {
    const isSyncing = syncingItemIds.includes(item.id);
    return (
      <TouchableOpacity
        key={`syncerror-${item.id}`}
        onPress={() => retrySync(item)}
        disabled={isSyncing}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Refresh sync for ${name}`}
        style={{
          backgroundColor: "rgba(212, 175, 106, 0.1)",
          borderColor: "rgba(212, 175, 106, 0.3)",
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="refresh" size={15} color="#D4AF6A" />
        <Text
          style={{
            color: "#D4AF6A",
            fontSize: 12,
            fontWeight: "700",
            marginLeft: 6,
            flex: 1,
          }}
        >
          Trouble syncing {name} transactions — tap to refresh
        </Text>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#D4AF6A" />
        ) : (
          <Text style={{ color: "#D4AF6A", fontSize: 12, fontWeight: "800" }}>
            Refresh
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        backgroundColor: "#141416",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#1F1F23",
        padding: 16,
        marginBottom: 8,
      }}
    >
      {/* ── Row 1: Bank Connections Header ────────────────────────────── */}
      <TouchableOpacity
        activeOpacity={0.7}
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
            backgroundColor: "rgba(212, 175, 106, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(212, 175, 106, 0.25)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="business" size={18} color="#D4AF6A" />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Bank Connections
          </Text>
          <Text style={{ color: "#8E8E93", fontSize: 12, marginTop: 2 }}>
            Auto-sync your transactions securely
          </Text>
        </View>

        {linking ? (
          <ActivityIndicator size="small" color="#D4AF6A" />
        ) : (
          <Ionicons name="chevron-forward" size={18} color="#636366" />
        )}
      </TouchableOpacity>

      {/* ── Divider & Row 2: Connected Items or Empty State ────────────── */}
      {loadingItems && items.length === 0 ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: "#1F1F23",
          }}
        >
          <ActivityIndicator
            size="small"
            color="#D4AF6A"
            style={{ paddingVertical: 6 }}
          />
        </View>
      ) : items.length > 0 ? (
        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: "#1F1F23",
          }}
        >
          {items.map((item, index) => {
            const name = displayName(item.institutionName);
            const isDisconnecting = disconnectingId === item.id;
            return (
              <View
                key={item.id}
                style={{
                  marginTop: index > 0 ? 10 : 0,
                  paddingTop: index > 0 ? 10 : 0,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: "#1F1F23",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: "rgba(212, 175, 106, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <Ionicons name="business" size={16} color="#D4AF6A" />
                  </View>

                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: "#8E8E93",
                        fontSize: 11.5,
                        marginTop: 1,
                      }}
                    >
                      Connected {formatDate(item.createdAt)}
                      {item.lastSyncedAt
                        ? ` · Last synced ${formatRelativeTime(item.lastSyncedAt)}`
                        : ""}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => onDisconnect(item)}
                    disabled={isDisconnecting}
                    accessibilityRole="button"
                    accessibilityLabel={`Disconnect ${name}`}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: "rgba(248, 113, 113, 0.12)",
                      borderWidth: 1,
                      borderColor: "rgba(248, 113, 113, 0.25)",
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      marginLeft: 8,
                    }}
                  >
                    {isDisconnecting ? (
                      <ActivityIndicator size="small" color="#F87171" />
                    ) : (
                      <Text
                        style={{
                          color: "#F87171",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Disconnect
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {item.status === "REQUIRES_REAUTH" && reconnectRow(item, name)}
                {item.syncError && syncErrorRow(item, name)}
              </View>
            );
          })}
        </View>
      ) : (
        <View
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: "#1F1F23",
          }}
        >
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            No banks connected yet — tap above to link your first account.
          </Text>
        </View>
      )}
    </View>
  );
}
