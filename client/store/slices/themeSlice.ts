import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { APPEARANCE_PALETTES, THEME_PALETTES } from "@/constants/ThemePalettes";
import type {
  AccentPreference,
  IThemeState,
  ThemePreference,
} from "@/types/theme/types";
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

const ACCENT_STORAGE_KEY = "selectedAccent";

function normalizeAccent(value: unknown): AccentPreference {
  return value === "Iris" || value === "Fern" ? value : "Cobalt";
}

function updatePalette(state: IThemeState) {
  state.THEME =
    APPEARANCE_PALETTES[state.selectedAccent ?? "Cobalt"][
      state.selectedTheme === "Dark" ? "DARK" : "LIGHT"
    ];
}

export const loadAccentFromStorage = createAsyncThunk(
  "theme/loadAccent",
  async () => {
    try {
      return normalizeAccent(await AsyncStorage.getItem(ACCENT_STORAGE_KEY));
    } catch (error) {
      logger.warn("themeSlice", "Failed to load accent", error);
      return "Cobalt" as const;
    }
  },
);

export const selectAccent = createAsyncThunk(
  "theme/selectAccent",
  async (accent: AccentPreference, { dispatch }) => {
    dispatch(themeSlice.actions.setAccent(accent));
    try {
      await AsyncStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch (error) {
      logger.warn("themeSlice", "Failed to save accent", error);
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
      updatePalette(state);
    },
    setAccent: (state, action) => {
      state.selectedAccent = normalizeAccent(action.payload);
      updatePalette(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAccentFromStorage.fulfilled, (state, action) => {
        if (state.selectedAccent !== undefined) return;
        state.selectedAccent = action.payload;
        updatePalette(state);
      })
      .addCase(loadThemeFromStorage.fulfilled, (state, action) => {
        const name = normalizeThemePreference(action.payload);
        state.selectedTheme = name;
        updatePalette(state);
      })
      .addCase(loadThemeFromStorage.rejected, (state, action) => {
        logger.warn("themeSlice", "Theme load thunk rejected", action.error);
      });
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
