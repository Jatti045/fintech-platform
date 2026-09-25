import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

import ProfileAvatar from "./ProfileAvatar";
import type { ProfileHeaderProps } from "@/types/profile/types";

/**
 * Profile Account Card matching the approved mockup:
 * Left: Circular avatar with thin gold border & camera icon.
 * Right: User name, email, and gold-outlined "Budgee member" pill.
 * Far Right: Subtle interactive chevron.
 */
export default function ProfileHeader({
  THEME,
  user,
  uploading,
  deleting,
  onPickImage,
  onDeleteImage,
}: ProfileHeaderProps) {
  const displayName = user?.username || "James A";
  const displayEmail = user?.email || "james.attia@gmail.com";

  return (
    <View
      style={{
        backgroundColor: "#141416",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#1F1F23",
        padding: 16,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {/* Left: Avatar */}
      <ProfileAvatar
        THEME={THEME}
        user={user}
        uploading={uploading}
        deleting={deleting}
        onPickImage={onPickImage}
        onDeleteImage={onDeleteImage}
      />

      {/* Middle: Details */}
      <View style={{ flex: 1, marginLeft: 16, justifyContent: "center" }}>
        <Text
          numberOfLines={1}
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: "800",
            letterSpacing: -0.3,
          }}
        >
          {displayName}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: "#8E8E93",
            fontSize: 13,
            marginTop: 2,
            marginBottom: 8,
          }}
        >
          {displayEmail}
        </Text>

        {/* Budgee member pill */}
        <View
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
            backgroundColor: "rgba(212, 175, 106, 0.08)",
            borderWidth: 1,
            borderColor: "rgba(212, 175, 106, 0.3)",
          }}
        >
          <Feather
            name="shield"
            size={11}
            color="#D4AF6A"
            style={{ marginRight: 5 }}
          />
          <Text
            style={{
              color: "#D4AF6A",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: -0.1,
            }}
          >
            Budgee member
          </Text>
        </View>
      </View>

      {/* Far Right: Interactive chevron */}
      <TouchableOpacity
        onPress={onPickImage}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        style={{ paddingLeft: 8 }}
      >
        <Ionicons name="chevron-forward" size={18} color="#636366" />
      </TouchableOpacity>
    </View>
  );
}
