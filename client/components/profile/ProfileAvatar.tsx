import React from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import type { ProfileAvatarProps } from "@/types/profile/types";

/**
 * Avatar with thin accent border, surfaceHover interior, and camera icon or uploaded image.
 * Supports tap-to-upload and long-press-to-delete.
 */
export default function ProfileAvatar({
  THEME: propTheme,
  user,
  onPickImage,
  onDeleteImage,
}: ProfileAvatarProps) {
  const { THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;

  return (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 1.5,
        borderColor: theme.primary,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.surfaceHover,
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
            backgroundColor: theme.surfaceHover,
          }}
        >
          <Ionicons name="camera" size={26} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
