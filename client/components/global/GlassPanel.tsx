import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba, tintHex } from "@/utils/helper";

export type GlassTone =
  | "surface"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Uniform padding. Overridden by paddingX / paddingY. */
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  tone?: GlassTone;
  /**
   * Nudges the base gradient toward the tone colour and adds a faint
   * ambient glow orb — use sparingly for hero surfaces.
   */
  tinted?: boolean;
  /** Adds a soft ambient glow orb behind the panel. */
  glow?: boolean;
}

/**
 * Liquid-glass surface primitive.
 *
 * Pure RN + LinearGradient (no BlurView) so it is deterministic, fast, and
 * identical across iOS / Android / web. Reads like glass:
 *   - gradient base tinted from the active theme
 *   - 1px hairline border with a translucent accent
 *   - 1.5px top specular highlight
 *   - soft layered shadow (+ ambient glow orbs when `glow`)
 */
const GlassPanel = React.memo(function GlassPanel({
  children,
  style,
  radius = 22,
  padding = 16,
  paddingX,
  paddingY,
  tone = "surface",
  tinted = false,
  glow = false,
}: GlassPanelProps) {
  const { THEME } = useTheme();

  const accent =
    tone === "surface"
      ? THEME.primary
      : tone === "success"
        ? THEME.success
        : tone === "warning"
          ? THEME.warning
          : tone === "danger"
            ? THEME.danger
            : THEME.primary;

  const surfaceTint = tinted || tone !== "surface";
  const base = surfaceTint
    ? tintHex(accent, 10)
    : tintHex(THEME.surface, 6);
  const baseDeep = surfaceTint
    ? tintHex(accent, tone === "danger" ? -26 : tone === "success" ? -22 : -18)
    : tintHex(THEME.surface, -22);

  const borderColor = hexToRgba(
    tone === "surface" ? THEME.border : accent,
    tone === "surface" ? 0.55 : 0.5,
  );

  return (
    <View
      style={[
        styles.outer,
        {
          borderRadius: radius,
          borderColor,
          elevation: 8,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[base, baseDeep]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, { borderRadius: radius }]}
      >
        {glow && (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.glowOrb,
                {
                  backgroundColor: hexToRgba(accent, 0.14),
                  top: -46,
                  right: -34,
                  width: 130,
                  height: 130,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.glowOrb,
                {
                  backgroundColor: hexToRgba(THEME.primary, 0.07),
                  bottom: -60,
                  left: -46,
                  width: 180,
                  height: 180,
                },
              ]}
            />
          </>
        )}

        {/* Top specular highlight — the “wet” edge of the glass. */}
        <View
          pointerEvents="none"
          style={[
            styles.specular,
            {
              borderRadius: radius,
              backgroundColor: hexToRgba("#FFFFFF", 0.1),
            },
          ]}
        />

        <View
          style={{
            paddingHorizontal: paddingX ?? padding,
            paddingVertical: paddingY ?? padding,
          }}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  fill: { flex: 1, overflow: "hidden" },
  glowOrb: { position: "absolute", borderRadius: 999 },
  specular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.6,
  },
});

export default GlassPanel;