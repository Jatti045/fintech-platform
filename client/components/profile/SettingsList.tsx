import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SettingsListProps } from "@/types/profile/types";

/**
 * SettingsList — Security & Account actions matching the approved design system:
 * - Neutral actions (Log Out, Change Password) in a subtle dark card with dividers.
 * - Destructive action (Delete Account) in a separate restrained red-bordered card.
 */
export default function SettingsList({ items }: SettingsListProps) {
  const destructiveIndex = items.findIndex((i) => i.isDestructive);
  const neutralItems = items.filter((i) => !i.isDestructive);
  const destructiveItem =
    destructiveIndex >= 0 ? items[destructiveIndex] : null;

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Neutral Items Card */}
      <View
        style={{
          backgroundColor: "#141416",
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#1F1F23",
          overflow: "hidden",
        }}
      >
        {neutralItems.map((item, i) => (
          <View key={`${item.title}-${item.icon}`}>
            <TouchableOpacity
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#1A1A1E",
                  borderWidth: 1,
                  borderColor: "#26262A",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name={item.icon as any} size={17} color="#FFFFFF" />
              </View>

              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14.5,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {item.title}
              </Text>

              <Ionicons name="chevron-forward" size={16} color="#636366" />
            </TouchableOpacity>

            {i < neutralItems.length - 1 ? (
              <View
                style={{
                  height: 1,
                  marginHorizontal: 14,
                  backgroundColor: "#1F1F23",
                }}
              />
            ) : null}
          </View>
        ))}
      </View>

      {/* Destructive Item Card */}
      {destructiveItem ? (
        <View
          style={{
            backgroundColor: "#141416",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(248, 113, 113, 0.25)",
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          <TouchableOpacity
            onPress={destructiveItem.onPress}
            accessibilityRole="button"
            accessibilityLabel={destructiveItem.title}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 14,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(248, 113, 113, 0.1)",
                borderWidth: 1,
                borderColor: "rgba(248, 113, 113, 0.2)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons name="trash-outline" size={17} color="#F87171" />
            </View>

            <Text
              style={{
                color: "#F87171",
                fontSize: 14.5,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {destructiveItem.title}
            </Text>

            <Ionicons name="chevron-forward" size={16} color="#F87171" />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
