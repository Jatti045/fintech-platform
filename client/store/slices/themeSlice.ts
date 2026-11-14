import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import type { IThemeState, ThemePreference } from "@/types/theme/types";
import { logger } from "@/utils/logger";

export const normalizeThemePreference = (value: unknown): ThemePreference =>
  value === "Light" || value === "Dark" ? value : "System";

const initialState: IThemeState = {
  selectedTheme: "System",
  THEME: THEME_PALETTES.LIGHT,
};

export const loadThemeFromStorage = createAsyncThunk(
  "theme/loadFromStorage",
  async (_, { rejectWithValue }) => {
    try {
      const storedTheme = await AsyncStorage.getItem("selectedTheme");
      const preference = normalizeThemePreference(storedTheme);
      if (storedTheme !== null && storedTheme !== preference) {
        // Persist the migration once so removed preferences cannot reappear.
        await AsyncStorage.setItem("selectedTheme", preference);
      }
      return preference;
    } catch (error) {
      logger.warn("themeSlice", "Failed to load theme from storage", error);
      return rejectWithValue("Failed to load theme");
    }
  },
);

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action) => {
      const name = normalizeThemePreference(action.payload);
      state.selectedTheme = name;
      state.THEME = name === "Dark" ? THEME_PALETTES.DARK : THEME_PALETTES.LIGHT;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadThemeFromStorage.fulfilled, (state, action) => {
        const name = normalizeThemePreference(action.payload);
        state.selectedTheme = name;
        state.THEME = name === "Dark" ? THEME_PALETTES.DARK : THEME_PALETTES.LIGHT;
      })
      .addCase(loadThemeFromStorage.rejected, (state, action) => {
        logger.warn("themeSlice", "Theme load thunk rejected", action.error);
      });
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
