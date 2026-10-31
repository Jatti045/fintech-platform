import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";

interface Props {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function BrandButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onPress,
}: Props) {
  const { THEME } = useTheme();
  const [pressed, setPressed] = useState(false);
  const blocked = !!(disabled || loading);
  const foreground = blocked ? THEME.textDisabled : THEME.onPrimary;
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
        minHeight: 54,
        borderRadius: BRAND.radius.button,
        backgroundColor: blocked
          ? THEME.disabledBackground
          : pressed
            ? THEME.primaryHover
            : THEME.primary,
        paddingHorizontal: BRAND.spacing.md,
        paddingVertical: BRAND.spacing.md,
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
            fontSize: 16,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {loading ? loadingLabel || label : label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
