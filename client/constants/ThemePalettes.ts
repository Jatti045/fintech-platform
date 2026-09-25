/**
 * Theme color palettes.
 *
 * Extracted from `themeSlice.ts` so the palette definitions are decoupled
 * from Redux boilerplate.  The slice now imports this map and stays lean.
 */

const dark = {
  background: "#0B0B0D",
  surface: "#141416",
  surfaceHover: "#1C1C1F",
  primary: "#D4AF6A",
  primaryHover: "#B8942F",
  secondary: "#F0D9A0",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E8E93",
  textDisabled: "#4A4540",
  success: "#34D399",
  danger: "#F87171",
  warning: "#D4A03A",
  border: "#212124",
  inputBackground: "#161618",
  placeholderText: "#636366",
  chart1: "#D4AF6A",
  chart2: "#F0D9A0",
  chart3: "#7BAECF",
  chart4: "#34D399",
};

const light = {
  background: "#F4F4F6",
  surface: "#FFFFFF",
  surfaceHover: "#EBECEF",
  primary: "#B8942F",
  primaryHover: "#9E7D24",
  secondary: "#C8A84B",
  textPrimary: "#111113",
  textSecondary: "#6B7280",
  textDisabled: "#9CA3AF",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  border: "#E5E7EB",
  inputBackground: "#F3F4F6",
  placeholderText: "#9CA3AF",
  chart1: "#B8942F",
  chart2: "#C8A84B",
  chart3: "#3B82F6",
  chart4: "#10B981",
};

// "Ember" — a minimal, warm, developer-focused aesthetic: warm paper
// neutrals with a terracotta/clay accent, generous contrast, no cool tones.
const ember = {
  background: "#16110E",
  surface: "#211915",
  surfaceHover: "#2C221D",
  primary: "#E8865A",
  primaryHover: "#D06E44",
  secondary: "#F2B48C",
  textPrimary: "#FDF8F5",
  textSecondary: "#A8988C",
  textDisabled: "#57493F",
  success: "#7FBF7F",
  danger: "#E06C5C",
  warning: "#E0A458",
  border: "#33261F",
  inputBackground: "#1B1410",
  placeholderText: "#7E6E63",
  chart1: "#E8865A",
  chart2: "#F2B48C",
  chart3: "#8FB8A8",
  chart4: "#7FBF7F",
};

// "Aurora" — a clean, modern, highly polished AI-chat aesthetic: soft
// violet-tinted surfaces with an indigo→violet accent, crisp hierarchy.
const aurora = {
  background: "#0D0E15",
  surface: "#151622",
  surfaceHover: "#1E2030",
  primary: "#7C6CF6",
  primaryHover: "#6553E0",
  secondary: "#A78BFA",
  textPrimary: "#F4F3FB",
  textSecondary: "#9B98B3",
  textDisabled: "#43415A",
  success: "#5ECFA0",
  danger: "#F0708A",
  warning: "#E8B95E",
  border: "#232538",
  inputBackground: "#11121C",
  placeholderText: "#656282",
  chart1: "#7C6CF6",
  chart2: "#A78BFA",
  chart3: "#5ECFA0",
  chart4: "#E8B95E",
};

export const THEME_PALETTES = {
  DARK: dark,
  LIGHT: light,
  EMBER: ember,
  AURORA: aurora,
} as const;

export type ThemePaletteKey = keyof typeof THEME_PALETTES;
export type ThemePalette = (typeof THEME_PALETTES)[ThemePaletteKey];
