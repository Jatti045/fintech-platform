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
  background: "#071D17",
  surface: "#102C23",
  surfaceHover: "#173E2E",
  primary: "#6CE0A0",
  primaryHover: "#93EAB8",
  secondary: "#6CE0A0",
  onPrimary: "#071D17",
  onDanger: "#071D17",
  textPrimary: "#EAF6EF",
  textSecondary: "#ADC7B8",
  textDisabled: "#ADC7B8",
  disabledBackground: "#27473A",
  success: "#6CE0A0",
  danger: "#FFB4AB",
  warning: "#F5CE80",
  border: "#27473A",
  inputBackground: "#102C23",
  placeholderText: "#ADC7B8",
  subtleSurface: "#173E2E",
  errorSurface: "#482923",
  chart1: "#6CE0A0",
  chart2: "#A6E664",
  chart3: "#84C8E8",
  chart4: "#D5B3F6",
};

const light = {
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

// "Ember" — a minimal, warm, developer-focused aesthetic: warm paper
// neutrals with a terracotta/clay accent, generous contrast, no cool tones.
const ember = {
  onPrimary: "#16110E",
  onDanger: "#16110E",
  disabledBackground: "#33261F",
  subtleSurface: "#2C221D",
  errorSurface: "#3C211C",
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
  onPrimary: "#0D0E15",
  onDanger: "#0D0E15",
  disabledBackground: "#232538",
  subtleSurface: "#1E2030",
  errorSurface: "#381F2E",
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
