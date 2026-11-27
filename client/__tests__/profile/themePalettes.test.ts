import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureStore } from "@reduxjs/toolkit";
import { THEME_PALETTES, sheetSurface } from "@/constants/ThemePalettes";
import { THEME_OPTIONS } from "@/utils/profile/profileService";
import reducer, {
  loadThemeFromStorage,
  setTheme,
} from "@/store/slices/themeSlice";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

it("supports exactly System, Light, and Dark", () => {
  expect(Object.keys(THEME_PALETTES).sort()).toEqual(["DARK", "LIGHT"]);
  expect(THEME_OPTIONS.map((option) => option.name)).toEqual([
    "System",
    "Light",
    "Dark",
  ]);
  for (const name of ["Light", "Dark"] as const) {
    expect(reducer(undefined, setTheme(name)).THEME).toEqual(
      THEME_PALETTES[name === "Dark" ? "DARK" : "LIGHT"],
    );
  }
});

it("keeps the light palette aligned with the statement and neutral surface design", () => {
  expect(THEME_PALETTES.LIGHT).toEqual({
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
  });
  expect(sheetSurface(THEME_PALETTES.LIGHT)).toBe(THEME_PALETTES.LIGHT.surface);
});

it("uses neutral dark surfaces and uses the high-contrast selected dock accent", () => {
  const dark = THEME_PALETTES.DARK;
  expect(dark.primary).toBe("#BCE8A1");
  expect(dark.background).toBe("#121212");
  expect(dark.surface).toBe("#1E1E1E");
  expect(sheetSurface(dark)).toBe("#242424");
  for (const key of [
    "background",
    "surface",
    "surfaceHover",
    "subtleSurface",
    "inputBackground",
    "border",
    "disabledBackground",
    "sheetHandle",
  ] as const) {
    const hex = dark[key].slice(1);
    expect(hex.slice(0, 2)).toBe(hex.slice(2, 4));
    expect(hex.slice(2, 4)).toBe(hex.slice(4, 6));
  }
});

it.each(["Ember", "Aurora"])(
  "migrates saved %s to System and persists the migration",
  async (legacy) => {
    await AsyncStorage.setItem("selectedTheme", legacy);
    const store = configureStore({ reducer: { theme: reducer } });
    await store.dispatch(loadThemeFromStorage());
    expect(store.getState().theme.selectedTheme).toBe("System");
    expect(await AsyncStorage.getItem("selectedTheme")).toBe("System");
  },
);

it.each(["Light", "Dark", "System"] as const)(
  "retains saved %s",
  async (preference) => {
    await AsyncStorage.setItem("selectedTheme", preference);
    const store = configureStore({ reducer: { theme: reducer } });
    await store.dispatch(loadThemeFromStorage());
    expect(store.getState().theme.selectedTheme).toBe(preference);
    expect(await AsyncStorage.getItem("selectedTheme")).toBe(preference);
  },
);

it("starts safely when storage cannot be read", async () => {
  jest
    .spyOn(AsyncStorage, "getItem")
    .mockRejectedValueOnce(new Error("Unavailable"));
  const store = configureStore({ reducer: { theme: reducer } });
  await store.dispatch(loadThemeFromStorage());
  expect(store.getState().theme.selectedTheme).toBe("System");
});
