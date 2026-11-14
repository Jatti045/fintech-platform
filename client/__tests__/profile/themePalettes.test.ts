import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureStore } from "@reduxjs/toolkit";
import { THEME_PALETTES, sheetSurface } from "@/constants/ThemePalettes";
import { THEME_OPTIONS } from "@/utils/profile/profileService";
import reducer, { loadThemeFromStorage, setTheme } from "@/store/slices/themeSlice";

jest.mock("expo-image-picker", () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));

it("supports exactly System, Light, and Dark", () => {
  expect(Object.keys(THEME_PALETTES).sort()).toEqual(["DARK", "LIGHT"]);
  expect(THEME_OPTIONS.map((option) => option.name)).toEqual(["System", "Light", "Dark"]);
  for (const name of ["Light", "Dark"] as const) {
    expect(reducer(undefined, setTheme(name)).THEME).toEqual(THEME_PALETTES[name === "Dark" ? "DARK" : "LIGHT"]);
  }
});

it("preserves every light palette token exactly", () => {
  expect(THEME_PALETTES.LIGHT).toEqual({
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
});
  expect(sheetSurface(THEME_PALETTES.LIGHT)).toBe(THEME_PALETTES.LIGHT.surface);
});

it("uses neutral dark surfaces and preserves the selected dock accent", () => {
  const dark = THEME_PALETTES.DARK;
  expect(dark.primary).toBe("#6CE0A0");
  expect(dark.background).toBe("#121212");
  expect(dark.surface).toBe("#1E1E1E");
  expect(sheetSurface(dark)).toBe("#282828");
  for (const key of ["background", "surface", "surfaceHover", "subtleSurface", "inputBackground", "border", "disabledBackground", "sheetHandle"] as const) {
    const hex = dark[key].slice(1);
    expect(hex.slice(0, 2)).toBe(hex.slice(2, 4));
    expect(hex.slice(2, 4)).toBe(hex.slice(4, 6));
  }
});

it.each(["Ember", "Aurora"])("migrates saved %s to System and persists the migration", async (legacy) => {
  await AsyncStorage.setItem("selectedTheme", legacy);
  const store = configureStore({ reducer: { theme: reducer } });
  await store.dispatch(loadThemeFromStorage());
  expect(store.getState().theme.selectedTheme).toBe("System");
  expect(await AsyncStorage.getItem("selectedTheme")).toBe("System");
});

it.each(["Light", "Dark", "System"] as const)("retains saved %s", async (preference) => {
  await AsyncStorage.setItem("selectedTheme", preference);
  const store = configureStore({ reducer: { theme: reducer } });
  await store.dispatch(loadThemeFromStorage());
  expect(store.getState().theme.selectedTheme).toBe(preference);
  expect(await AsyncStorage.getItem("selectedTheme")).toBe(preference);
});

it("starts safely when storage cannot be read", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Unavailable"));
  const store = configureStore({ reducer: { theme: reducer } });
  await store.dispatch(loadThemeFromStorage());
  expect(store.getState().theme.selectedTheme).toBe("System");
});
