import type { TextStyle } from "react-native";
import type { AccentPreference, ITheme } from "@/types/theme/types";

export const BRAND = {
  overlay: "rgba(8, 10, 16, 0.58)",
  lime: "#BCE8A1",
  radius: { input: 14, button: 14, card: 22, sheet: 28, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  gutter: 20,
  touchTarget: 48,
  contentWidth: 460,
  pageWidth: 680,
  motion: { press: 85, feedback: 150, reveal: 180, navigation: 195 },
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
  screen: { fontFamily: "FundleafDisplay", fontSize: 32, letterSpacing: -1 },
  section: { fontFamily: "FundleafDisplay", fontSize: 21, letterSpacing: -0.4 },
  label: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  amount: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  total: {
    fontFamily: "FundleafDisplay",
    fontSize: 40,
    letterSpacing: -1.8,
    fontVariant: ["tabular-nums"],
  },
} satisfies Record<TextRole, TextStyle>;

const darkNeutral = {
  sheetHandle: "#777780",
  sheetBackdrop: "#000000",
  sheet: "#202125",
  background: "#141416",
  surface: "#1C1D21",
  surfaceHover: "#292A31",
  onDanger: "#2D171A",
  textPrimary: "#F5F5FA",
  textSecondary: "#B4B5C1",
  textDisabled: "#A5A7B2",
  disabledBackground: "#303137",
  success: "#82DAB3",
  danger: "#FFADB8",
  warning: "#FED08C",
  border: "#373941",
  inputBackground: "#232429",
  placeholderText: "#B4B5C1",
  subtleSurface: "#25262C",
  errorSurface: "#39282D",
  chart2: "#82DAB3",
  chart3: "#F0BE92",
  chart4: "#DDB7EE",
};
const lightNeutral = {
  sheetHandle: "#737785",
  sheetBackdrop: "#151727",
  sheet: "#FFFFFF",
  background: "#F5F6FA",
  surface: "#FFFFFF",
  surfaceHover: "#EDF0F6",
  onDanger: "#FFFFFF",
  textPrimary: "#171B2A",
  textSecondary: "#565E72",
  textDisabled: "#565E72",
  disabledBackground: "#E4E7EF",
  success: "#08704F",
  danger: "#AA3449",
  warning: "#855217",
  border: "#DDE1EB",
  inputBackground: "#FFFFFF",
  placeholderText: "#565E72",
  subtleSurface: "#EBEDF5",
  errorSurface: "#FAE9ED",
  chart2: "#168161",
  chart3: "#986018",
  chart4: "#7954A6",
};

export const ACCENTS = {
  Cobalt: {
    light: {
      ink: "#2948CB",
      pressed: "#203BB3",
      soft: "#E4EAFF",
      onInk: "#FFFFFF",
      panel: "#233EAF",
      panelText: "#F9FAFF",
      panelMuted: "#DCE5FF",
      series: "#C9D7FF",
      rule: "#6076C7",
      negative: "#FFD5DD",
    },
    dark: {
      ink: "#AABFFF",
      pressed: "#96AEF9",
      soft: "#282F4D",
      onInk: "#18244A",
      panel: "#232E55",
      panelText: "#F9FAFF",
      panelMuted: "#D0DAF8",
      series: "#AEC1FF",
      rule: "#52628F",
      negative: "#FFD5DD",
    },
  },
  Iris: {
    light: {
      ink: "#6541AC",
      pressed: "#52318F",
      soft: "#EFE7FC",
      onInk: "#FFFFFF",
      panel: "#4B2F84",
      panelText: "#FFF9FF",
      panelMuted: "#F0E3FC",
      series: "#E3CCFF",
      rule: "#8265AB",
      negative: "#FFD5DD",
    },
    dark: {
      ink: "#D7BDFF",
      pressed: "#C7A7FC",
      soft: "#362A48",
      onInk: "#2A1D3C",
      panel: "#35264D",
      panelText: "#FFF9FF",
      panelMuted: "#EADCF8",
      series: "#D7BDFF",
      rule: "#6E578C",
      negative: "#FFD5DD",
    },
  },
  Fern: {
    light: {
      ink: "#146653",
      pressed: "#0E5343",
      soft: "#DBF0E9",
      onInk: "#FFFFFF",
      panel: "#115443",
      panelText: "#F4FFFB",
      panelMuted: "#D1F2E6",
      series: "#B7EFDB",
      rule: "#4C8677",
      negative: "#FFD5DD",
    },
    dark: {
      ink: "#93DECA",
      pressed: "#79CFB9",
      soft: "#233D36",
      onInk: "#112C26",
      panel: "#203D37",
      panelText: "#F4FFFB",
      panelMuted: "#CFEDE4",
      series: "#A4EBD8",
      rule: "#537A70",
      negative: "#FFD5DD",
    },
  },
} as const;

const neutral = { LIGHT: lightNeutral, DARK: darkNeutral };
export type ThemePaletteKey = keyof typeof neutral;
export type ThemePalette = ITheme;

function makePalette(
  appearance: ThemePaletteKey,
  accent: AccentPreference,
): ITheme {
  const colors = ACCENTS[accent][appearance === "DARK" ? "dark" : "light"];
  return {
    ...neutral[appearance],
    primary: colors.ink,
    primaryHover: colors.pressed,
    secondary: colors.ink,
    onPrimary: colors.onInk,
    accentSurface: colors.soft,
    chart1: colors.ink,
    statement: colors.panel,
    statementText: colors.panelText,
    statementMuted: colors.panelMuted,
    statementAccent: colors.series,
    statementRule: colors.rule,
    statementDanger: colors.negative,
  };
}

export const APPEARANCE_PALETTES = {
  Cobalt: {
    LIGHT: makePalette("LIGHT", "Cobalt"),
    DARK: makePalette("DARK", "Cobalt"),
  },
  Iris: {
    LIGHT: makePalette("LIGHT", "Iris"),
    DARK: makePalette("DARK", "Iris"),
  },
  Fern: {
    LIGHT: makePalette("LIGHT", "Fern"),
    DARK: makePalette("DARK", "Fern"),
  },
};

export const THEME_PALETTES = APPEARANCE_PALETTES.Cobalt;

export const isDarkPalette = (theme: { background: string }) =>
  theme.background === darkNeutral.background;

export const sheetSurface = (
  theme: { background: string; surface: string; sheet?: string },
  lightSurface = theme.surface,
) => (isDarkPalette(theme) ? (theme.sheet ?? darkNeutral.sheet) : lightSurface);

export const accentSurface = (
  theme: { background: string; subtleSurface: string },
  lightColor: string,
) => (isDarkPalette(theme) ? theme.subtleSurface : lightColor);
