import FundleafLoader from "@/components/brand/FundleafLoader";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressMotion } from "@/hooks/usePressMotion";
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
  const press = usePressMotion();
  const blocked = !!(disabled || loading);
  const primary = tone === "primary";
  const fill = primary ? THEME.primary : THEME.subtleSurface;
  const foreground = blocked
    ? THEME.textDisabled
    : primary
      ? THEME.onPrimary
      : THEME.textPrimary;
  return (
    <Animated.View style={press.style}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: blocked, busy: !!loading }}
        disabled={blocked}
        onPress={() => {
          if (!blocked) onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={0.85}
        style={{
          minHeight: BRAND.touchTarget,
          borderRadius: BRAND.radius.button,
          backgroundColor: blocked ? THEME.disabledBackground : fill,
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
          {loading && <FundleafLoader color={foreground} size="small" />}
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
    </Animated.View>
  );
}
