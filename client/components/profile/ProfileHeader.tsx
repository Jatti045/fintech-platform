import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

import ProfileAvatar from "./ProfileAvatar";
import GlassPanel from "@/components/global/GlassPanel";
import { hexToRgba } from "@/utils/helper";
import type { ProfileHeaderProps } from "@/types/profile/types";

/**
 * Identity deck — a glass hero for the top of Profile: gradient avatar,
 * name, email and a small membership chip.
 */
export default function ProfileHeader({
  THEME,
  user,
  uploading,
  deleting,
  onPickImage,
  onDeleteImage,
}: ProfileHeaderProps) {
  return (
    <GlassPanel padding={18} radius={24} style={{ marginBottom: 16 }}>
      <View style={{ alignItems: "center" }}>
        <ProfileAvatar
          THEME={THEME}
          user={user}
          uploading={uploading}
          deleting={deleting}
          onPickImage={onPickImage}
          onDeleteImage={onDeleteImage}
        />

        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 22,
            fontWeight: "900",
            marginTop: 4,
          }}
        >
          {user?.username || "Your Name"}
        </Text>
        <Text
          style={{ color: THEME.textSecondary, fontSize: 14, marginTop: 2 }}
        >
          {user?.email || "your.email@email.com"}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
            backgroundColor: hexToRgba(THEME.primary, 0.12),
            borderColor: hexToRgba(THEME.primary, 0.3),
            borderWidth: 1,
          }}
        >
          <Feather
            name="shield"
            size={13}
            color={THEME.primary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={{ color: THEME.primary, fontSize: 12, fontWeight: "800" }}
          >
            Budgee member
          </Text>
        </View>
      </View>
    </GlassPanel>
  );
}
