import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { formatDate } from "@/utils/helper";
import { hexToRgba } from "@/utils/colorUtils";
import { formatRelativeTime } from "@/utils/plaidTime";
import { usePlaidHealth } from "@/hooks/plaid/usePlaidHealth";
import type { BankConnectionsProps } from "@/types/profile/types";
import type { IPlaidItem } from "@/types/plaid/types";

/**
 * Bank Connections — card matching the approved mockup:
 * First row: Theme bank icon, "Bank Connections", "Auto-sync your transactions securely", chevron.
 * Divider.
 * Second row: Connected bank item with subtle red "Disconnect" button.
 */
export default function BankConnections({
  THEME: propTheme,
  linking,
  onLinkBank,
  items,
  loadingItems,
  disconnectingId,
  onDisconnect,
}: BankConnectionsProps) {
  const { THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;
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
          backgroundColor: hexToRgba(theme.danger, 0.12),
          borderColor: hexToRgba(theme.danger, 0.35),
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-circle" size={15} color={theme.danger} />
        <Text
          style={{
            color: theme.danger,
            fontSize: 12,
            fontWeight: "700",
            marginLeft: 6,
            flex: 1,
          }}
        >
          {name} needs re-authentication — tap to reconnect
        </Text>
        {isReauthing ? (
          <ActivityIndicator size="small" color={theme.danger} />
        ) : (
          <Text
            style={{ color: theme.danger, fontSize: 12, fontWeight: "800" }}
          >
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
          backgroundColor: hexToRgba(theme.primary, 0.1),
          borderColor: hexToRgba(theme.primary, 0.3),
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="refresh" size={15} color={theme.primary} />
        <Text
          style={{
            color: theme.primary,
            fontSize: 12,
            fontWeight: "700",
            marginLeft: 6,
            flex: 1,
          }}
        >
          Trouble syncing {name} transactions — tap to refresh
        </Text>
        {isSyncing ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Text
            style={{ color: theme.primary, fontSize: 12, fontWeight: "800" }}
          >
            Refresh
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
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
            backgroundColor: hexToRgba(theme.primary, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(theme.primary, 0.25),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="business" size={18} color={theme.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.textPrimary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Bank Connections
          </Text>
          <Text
            style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}
          >
            Auto-sync your transactions securely
          </Text>
        </View>

        {linking ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.textSecondary}
          />
        )}
      </TouchableOpacity>

      {/* ── Divider & Row 2: Connected Items or Empty State ────────────── */}
      {loadingItems && items.length === 0 ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={{ paddingVertical: 6 }}
          />
        </View>
      ) : items.length > 0 ? (
        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
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
                  borderTopColor: theme.border,
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
                      backgroundColor: hexToRgba(theme.primary, 0.1),
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <Ionicons name="business" size={16} color={theme.primary} />
                  </View>

                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.textPrimary,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.textSecondary,
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
                      backgroundColor: hexToRgba(theme.danger, 0.12),
                      borderWidth: 1,
                      borderColor: hexToRgba(theme.danger, 0.25),
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      marginLeft: 8,
                    }}
                  >
                    {isDisconnecting ? (
                      <ActivityIndicator size="small" color={theme.danger} />
                    ) : (
                      <Text
                        style={{
                          color: theme.danger,
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
            borderTopColor: theme.border,
          }}
        >
          <Text
            style={{
              color: theme.textSecondary,
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
