// ─── Theme Domain Types ─────────────────────────────────────────────────────

export interface ITheme {
  sheetHandle: string;
  sheetBackdrop: string;
  sheet: string;
  background: string;
  surface: string;
  surfaceHover: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  onDanger: string;
  disabledBackground: string;
  subtleSurface: string;
  accentSurface: string;
  errorSurface: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  success: string;
  danger: string;
  warning: string;
  border: string;
  inputBackground: string;
  placeholderText: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  statement: string;
  statementText: string;
  statementMuted: string;
  statementAccent: string;
  statementRule: string;
  statementDanger: string;
}

export type ThemePreference = "System" | "Light" | "Dark";

export interface IThemeState {
  selectedTheme: ThemePreference;
  THEME: ITheme;
}
