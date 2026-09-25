import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useUser } from "@/hooks/useRedux";
import { capitalizeFirst } from "@/utils/helper";

type Props = {
  onInfoPress: () => void;
  onSettingsPress?: () => void;
};

/**
 * Dashboard Header matching the reference design:
 * Left: "Budgee" title and secondary muted greeting with emoji.
 * Right: Two understated, dark circular utility buttons:
 *   [ Information ] [ Settings ]
 *   - Information: opens the Help & Usage modal
 *   - Settings: navigates to the Profile screen
 */
export default function HomeHeader({ onInfoPress, onSettingsPress }: Props) {
  const user = useUser();

  const rawName = user?.username ? String(user.username) : "James";
  const name = capitalizeFirst(rawName.trim());

  const hour = new Date().getHours();
  const greetingText =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const emoji = hour < 18 ? "☀️" : "🌙";

  const handleSettings = () => {
    if (onSettingsPress) {
      onSettingsPress();
    } else {
      router.push("/(tabs)/profile");
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 4,
        marginBottom: 16,
      }}
    >
      <View>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 26,
            fontWeight: "800",
            letterSpacing: -0.5,
          }}
        >
          Budgee
        </Text>
        <Text
          style={{
            color: "#8E8E93",
            fontSize: 13.5,
            fontWeight: "400",
            marginTop: 2,
          }}
        >
          {greetingText}, {name} {emoji}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {/* Information button */}
        <TouchableOpacity
          onPress={onInfoPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Help and usage"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#1C1C1F",
            borderWidth: 1,
            borderColor: "#28282C",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="info" size={17} color="#E5E5EA" />
        </TouchableOpacity>

        {/* Settings button -> Profile */}
        <TouchableOpacity
          onPress={handleSettings}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#1C1C1F",
            borderWidth: 1,
            borderColor: "#28282C",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="settings" size={17} color="#E5E5EA" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
