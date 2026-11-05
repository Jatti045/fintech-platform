/**
 * Theme color palettes.
 *
 * Extracted from `themeSlice.ts` so the palette definitions are decoupled
 * from Redux boilerplate.  The slice now imports this map and stays lean.
 */

// Shared brand and geometry tokens. Semantic foreground pairs avoid assuming
// white text is readable on every primary color (especially in dark mode).
export const BRAND = {
  overlay: "rgba(7, 29, 23, 0.6)",
  lime: "#A6E664",
  radius: { input: 14, button: 14, card: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  touchTarget: 48,
  contentWidth: 460,
} as const;

const dark = {
  sheetHandle: "#666666",
  sheetBackdrop: "#000000",
  background: "#121212",
  surface: "#1E1E1E",
  surfaceHover: "#242424",
  primary: "#6CE0A0",
  primaryHover: "#93EAB8",
  secondary: "#6CE0A0",
  onPrimary: "#121212",
  onDanger: "#121212",
  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textDisabled: "#B3B3B3",
  disabledBackground: "#333333",
  success: "#6CE0A0",
  danger: "#FFB4AB",
  warning: "#F5CE80",
  border: "#333333",
  inputBackground: "#242424",
  placeholderText: "#B3B3B3",
  subtleSurface: "#242424",
  errorSurface: "#382523",
  chart1: "#6CE0A0",
  chart2: "#A6E664",
  chart3: "#84C8E8",
  chart4: "#D5B3F6",
};

const light = {
  sheetHandle: "#B8C9BE",
  sheetBackdrop: "#071D17",
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceHover: "#E7F4EC",
  primary: "#0C8057",
  primaryHover: "#096647",
  secondary: "#0C8057",
  onPrimary: "#FFFFFF",
  onDanger: "#FFFFFF",
  textPrimary: "#122A22",
  textSecondary: "#587166",
  textDisabled: "#587166",
  disabledBackground: "#D8E7DE",
  success: "#08734D",
  danger: "#B42318",
  warning: "#805600",
  border: "#D8E7DE",
  inputBackground: "#FFFFFF",
  placeholderText: "#587166",
  subtleSurface: "#E7F4EC",
  errorSurface: "#FFF0ED",
  chart1: "#0C8057",
  chart2: "#597C20",
  chart3: "#276E9D",
  chart4: "#8057A6",
};

export const THEME_PALETTES = {
  DARK: dark,
  LIGHT: light,
} as const;

export type ThemePaletteKey = keyof typeof THEME_PALETTES;
export type ThemePalette = (typeof THEME_PALETTES)[ThemePaletteKey];

/** Keep existing light tokens identical; dark sheets sit above card surfaces. */
export const sheetSurface = (
  theme: { background: string; surface: string },
  lightSurface = theme.surface,
) => theme.background === dark.background ? "#282828" : lightSurface;

export const isDarkPalette = (theme: { background: string }) =>
  theme.background === dark.background;

export const accentSurface = (theme: { background: string; subtleSurface: string }, lightColor: string) =>
  isDarkPalette(theme) ? theme.subtleSurface : lightColor;
