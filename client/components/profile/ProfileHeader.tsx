import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import ProfileAvatar from "./ProfileAvatar";
import type { ProfileHeaderProps } from "@/types/profile/types";

export default function ProfileHeader({
  THEME: propTheme,
  user,
  uploading,
  deleting,
  onPickImage,
  onDeleteImage,
}: ProfileHeaderProps) {
  const { THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;

  return (
    <View style={[styles.identity, { borderColor: theme.border }]}>
      <ProfileAvatar
        THEME={theme}
        user={user}
        uploading={uploading}
        deleting={deleting}
        onPickImage={onPickImage}
        onDeleteImage={onDeleteImage}
      />
      <View style={styles.details}>
        <Text style={[TYPE.section, { color: theme.textPrimary }]}>
          {user?.username || "Your account"}
        </Text>
        <Text style={[TYPE.caption, { color: theme.textSecondary }]}>
          {user?.email || "Account details unavailable"}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onPickImage}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Change profile picture"
        disabled={uploading || deleting}
        style={styles.edit}
      >
        <Feather name="edit-2" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: BRAND.spacing.sm,
    paddingVertical: BRAND.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  details: { flex: 1, minWidth: 0, gap: BRAND.spacing.xs },
  edit: {
    width: BRAND.touchTarget,
    minHeight: BRAND.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
