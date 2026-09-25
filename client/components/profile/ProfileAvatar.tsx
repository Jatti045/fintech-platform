import React from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ProfileAvatarProps } from "@/types/profile/types";

/**
 * Avatar with thin warm-gold border, dark charcoal interior, and camera icon or uploaded image.
 * Supports tap-to-upload and long-press-to-delete.
 */
export default function ProfileAvatar({
  user,
  onPickImage,
  onDeleteImage,
}: ProfileAvatarProps) {
  return (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 1.5,
        borderColor: "#D4AF6A",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#18181B",
        overflow: "hidden",
      }}
    >
      {user?.profilePic ? (
        <TouchableOpacity
          onPress={onPickImage}
          onLongPress={onDeleteImage}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Change or remove profile picture"
        >
          <Image
            source={{ uri: user.profilePic }}
            style={{ width: 68, height: 68, borderRadius: 34 }}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPickImage}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Upload profile picture"
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#18181B",
          }}
        >
          <Ionicons name="camera" size={26} color="#8E8E93" />
        </TouchableOpacity>
      )}
    </View>
  );
}
