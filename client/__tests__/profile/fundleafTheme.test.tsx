import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useColorScheme } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import reducer, {
  loadThemeFromStorage,
  setTheme,
} from "@/store/slices/themeSlice";

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const c = parseInt(channel, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

it.each(["LIGHT", "DARK"] as const)(
  "%s semantic foregrounds meet normal-text contrast",
  (key) => {
    const t = THEME_PALETTES[key];
    for (const foreground of [
      t.textPrimary,
      t.textSecondary,
      t.placeholderText,
      t.success,
      t.warning,
      t.danger,
      t.primary,
    ]) {
      expect(contrast(foreground, t.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(foreground, t.background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t.onDanger, t.danger)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.onPrimary, t.primaryHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.danger, t.errorSurface)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(t.textDisabled, t.disabledBackground),
    ).toBeGreaterThanOrEqual(3);
  },
);

it("uses device appearance without a saved preference and follows subsequent changes", () => {
  const scheme = useColorScheme as jest.Mock;
  scheme.mockReturnValue("dark");
  const store = configureStore({ reducer: { theme: reducer } });
  let result!: ReturnType<typeof useTheme>;
  function Probe() {
    result = useTheme();
    return null;
  }
  let tree!: renderer.ReactTestRenderer;
  const render = () => (
    <Provider store={store}>
      <Probe />
    </Provider>
  );
  renderer.act(() => {
    tree = renderer.create(render());
  });
  expect(result.THEME).toBe(THEME_PALETTES.DARK);
  expect(store.getState().theme.selectedTheme).toBe("System");
  scheme.mockReturnValue("light");
  renderer.act(() => {
    tree.update(render());
  });
  expect(result.THEME).toBe(THEME_PALETTES.LIGHT);
  renderer.act(() => {
    store.dispatch(setTheme("Ember"));
  });
  scheme.mockReturnValue("dark");
  renderer.act(() => {
    tree.update(render());
  });
  expect(result.THEME).toBe(THEME_PALETTES.EMBER);
  renderer.act(() => {
    tree.unmount();
  });
  scheme.mockReturnValue("light");
});

it("retains saved choices and safely handles unknown or malformed theme selections", () => {
  for (const name of ["Light", "Dark", "Ember", "Aurora", "System"]) {
    expect(
      reducer(undefined, loadThemeFromStorage.fulfilled(name, "", undefined))
        .selectedTheme,
    ).toBe(name);
  }
  expect(
    reducer(undefined, loadThemeFromStorage.fulfilled(null, "", undefined))
      .selectedTheme,
  ).toBe("System");
  for (const value of [null, {}, "Ocean", "Rose", "missing"]) {
    expect(reducer(undefined, setTheme(value)).selectedTheme).toBe("Light");
  }
});
