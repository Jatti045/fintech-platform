import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";

interface Props {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary";
  onPress: () => void;
}

export default function BrandButton({
  label,
  loadingLabel,
  loading,
  disabled,
  tone = "primary",
  onPress,
}: Props) {
  const { THEME } = useTheme();
  const [pressed, setPressed] = useState(false);
  const blocked = !!(disabled || loading);
  const primary = tone === "primary";
  const fill = primary ? THEME.primary : THEME.subtleSurface;
  const pressFill = primary ? THEME.primaryHover : THEME.surfaceHover;
  const foreground = blocked
    ? THEME.textDisabled
    : primary
      ? THEME.onPrimary
      : THEME.textPrimary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: !!loading }}
      disabled={blocked}
      onPress={() => {
        if (!blocked) onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={0.85}
      style={{
        minHeight: BRAND.touchTarget,
        borderRadius: BRAND.radius.button,
        backgroundColor: blocked
          ? THEME.disabledBackground
          : pressed
            ? pressFill
            : fill,
        paddingHorizontal: BRAND.spacing.md,
        paddingVertical: 12,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: BRAND.spacing.sm,
        }}
      >
        {loading && <ActivityIndicator color={foreground} size="small" />}
        <Text
          style={{
            color: foreground,
            ...TYPE.label,
            flexShrink: 1,
            textAlign: "center",
          }}
        >
          {loading ? loadingLabel || label : label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
