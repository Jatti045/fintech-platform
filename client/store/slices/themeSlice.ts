import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import type { ITheme, IThemeState } from "@/types/theme/types";
import { logger } from "@/utils/logger";

const initialState: IThemeState = {
  selectedTheme: "Dark",
  THEME: THEME_PALETTES.DARK,
};

export const loadThemeFromStorage = createAsyncThunk(
  "theme/loadFromStorage",
  async (_, { rejectWithValue }) => {
    try {
      const storedTheme = await AsyncStorage.getItem("selectedTheme");
      return storedTheme;
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
      const key = action.payload.toUpperCase() as keyof typeof THEME_PALETTES;
      state.selectedTheme = action.payload;
      state.THEME = THEME_PALETTES[key] ?? THEME_PALETTES.LIGHT;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadThemeFromStorage.fulfilled, (state, action) => {
        const storedTheme = action.payload;
        if (!storedTheme) {
          state.selectedTheme = "Light";
          state.THEME = THEME_PALETTES.LIGHT;
          return;
        }
        const key = storedTheme.toUpperCase() as keyof typeof THEME_PALETTES;
        state.selectedTheme = THEME_PALETTES[key] ? storedTheme : "Light";
        state.THEME = THEME_PALETTES[key] ?? THEME_PALETTES.LIGHT;
      })
      .addCase(loadThemeFromStorage.rejected, (state, action) => {
        logger.warn("themeSlice", "Theme load thunk rejected", action.error);
      });
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
