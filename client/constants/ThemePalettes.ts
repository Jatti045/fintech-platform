import type { TextStyle } from "react-native";
import type { ITheme } from "@/types/theme/types";

/** Cross-platform layout, typography and motion for the mobile interface. */
export const BRAND = {
  overlay: "rgba(0, 0, 0, 0.56)",
  lime: "#BCE8A1",
  radius: { input: 10, button: 10, card: 16, sheet: 22, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  touchTarget: 48,
  contentWidth: 460,
  pageWidth: 680,
  motion: { feedback: 120, reveal: 180, navigation: 200 },
} as const;

type TextRole =
  | "screen"
  | "section"
  | "label"
  | "body"
  | "caption"
  | "amount"
  | "total";
export const TYPE = {
  screen: { fontSize: 27, fontWeight: "700", letterSpacing: -0.8 },
  section: { fontSize: 19, fontWeight: "700", letterSpacing: -0.3 },
  label: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  amount: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  total: {
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1.3,
    fontVariant: ["tabular-nums"],
  },
} satisfies Record<TextRole, TextStyle>;

const dark = {
  sheetHandle: "#767676",
  sheetBackdrop: "#000000",
  sheet: "#242424",
  background: "#121212",
  surface: "#1E1E1E",
  surfaceHover: "#2B2B2B",
  primary: "#BCE8A1",
  primaryHover: "#A5D488",
  secondary: "#BCE8A1",
  onPrimary: "#172515",
  onDanger: "#241614",
  textPrimary: "#F6F6F4",
  textSecondary: "#AEAFAB",
  textDisabled: "#A3A3A0",
  disabledBackground: "#333333",
  success: "#BCE8A1",
  danger: "#FFB4AB",
  warning: "#F1CE87",
  border: "#363636",
  inputBackground: "#202020",
  placeholderText: "#AEAFAB",
  subtleSurface: "#252525",
  accentSurface: "#29382A",
  errorSurface: "#352624",
  chart1: "#BCE8A1",
  chart2: "#A5BCAD",
  chart3: "#B4BEC9",
  chart4: "#CABBAB",
  statement: "#1E1E1E",
  statementText: "#F6F6F4",
  statementMuted: "#BCBDB8",
  statementAccent: "#BCE8A1",
  statementRule: "#434640",
  statementDanger: "#FFB4AB",
};

const light = {
  sheetHandle: "#798279",
  sheetBackdrop: "#000000",
  sheet: "#FFFFFF",
  background: "#F7F8F4",
  surface: "#FFFFFF",
  surfaceHover: "#EBEFE7",
  primary: "#274D35",
  primaryHover: "#1E3E2A",
  secondary: "#274D35",
  onPrimary: "#FFFFFF",
  onDanger: "#FFFFFF",
  textPrimary: "#191E19",
  textSecondary: "#575F56",
  textDisabled: "#575F56",
  disabledBackground: "#E2E7DE",
  success: "#305D3B",
  danger: "#A22C22",
  warning: "#805600",
  border: "#D9DED5",
  inputBackground: "#EEF0EA",
  placeholderText: "#575F56",
  subtleSurface: "#EBEEE7",
  accentSurface: "#E0ECD9",
  errorSurface: "#FAEBE7",
  chart1: "#40674B",
  chart2: "#6A7550",
  chart3: "#536678",
  chart4: "#745F50",
  statement: "#23392B",
  statementText: "#F7F8F4",
  statementMuted: "#C2D1C1",
  statementAccent: "#BCE8A1",
  statementRule: "#536958",
  statementDanger: "#FFB4AB",
};

export const THEME_PALETTES = { DARK: dark, LIGHT: light } satisfies Record<
  "DARK" | "LIGHT",
  ITheme
>;
export type ThemePaletteKey = keyof typeof THEME_PALETTES;
export type ThemePalette = (typeof THEME_PALETTES)[ThemePaletteKey];

export const isDarkPalette = (theme: { background: string }) =>
  theme.background === dark.background;

export const sheetSurface = (
  theme: { background: string; surface: string; sheet?: string },
  lightSurface = theme.surface,
) => (isDarkPalette(theme) ? (theme.sheet ?? dark.sheet) : lightSurface);

export const accentSurface = (
  theme: { background: string; subtleSurface: string },
  lightColor: string,
) => (isDarkPalette(theme) ? theme.subtleSurface : lightColor);
