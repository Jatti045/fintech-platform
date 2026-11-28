import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureStore } from "@reduxjs/toolkit";
import {
  APPEARANCE_PALETTES,
  THEME_PALETTES,
  sheetSurface,
} from "@/constants/ThemePalettes";
import { THEME_OPTIONS } from "@/utils/profile/profileService";
import reducer, {
  loadAccentFromStorage,
  loadThemeFromStorage,
  selectAccent,
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

it("uses distinct accent palettes across the same neutral surfaces and financial colors", () => {
  for (const key of ["LIGHT", "DARK"] as const) {
    const options = Object.values(APPEARANCE_PALETTES).map(
      (scheme) => scheme[key],
    );
    expect(new Set(options.map((option) => option.primary)).size).toBe(3);
    expect(new Set(options.map((option) => option.statement)).size).toBe(3);
    for (const option of options) {
      expect(option.background).toBe(THEME_PALETTES[key].background);
      expect(option.success).toBe(THEME_PALETTES[key].success);
      expect(option.danger).toBe(THEME_PALETTES[key].danger);
      expect(sheetSurface(option)).toBe(option.sheet);
    }
  }
});

it("persists the accent independently of matching the system appearance", async () => {
  await AsyncStorage.setItem("selectedTheme", "System");
  const store = configureStore({ reducer: { theme: reducer } });
  await store.dispatch(selectAccent("Iris"));
  expect(store.getState().theme.THEME).toEqual(APPEARANCE_PALETTES.Iris.LIGHT);
  expect(await AsyncStorage.getItem("selectedTheme")).toBe("System");
  expect(await AsyncStorage.getItem("selectedAccent")).toBe("Iris");
  const restored = configureStore({ reducer: { theme: reducer } });
  await restored.dispatch(loadAccentFromStorage());
  restored.dispatch(setTheme("Dark"));
  expect(restored.getState().theme.THEME).toEqual(
    APPEARANCE_PALETTES.Iris.DARK,
  );
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
