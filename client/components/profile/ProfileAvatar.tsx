import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";

import { useTheme } from "@/hooks/useRedux";
import type { ProfileAvatarProps } from "@/types/profile/types";

/**
 * Avatar with thin accent border, surfaceHover interior, and camera icon or uploaded image.
 * Supports tap-to-upload and long-press-to-delete.
 */
export default function ProfileAvatar({
  THEME: propTheme,
  user,
  uploading,
  deleting,
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
          disabled={uploading || deleting}
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
          disabled={uploading || deleting}
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
          <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: "700" }}>{user?.username?.trim().slice(0, 2).toUpperCase() || "FL"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
