import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import "../global.css";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store, loadUserFromStorage, useAuth } from "../store";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { ActivityIndicator, Image, StatusBar, View } from "react-native";
import { loadThemeFromStorage } from "@/store/slices/themeSlice";
import { hydrateApiCache } from "@/store/api/cachePersistence";
import { AlertProvider } from "@/utils/themedAlert";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AppErrorBoundary from "@/components/global/AppErrorBoundary";
import { useNotifications } from "@/hooks/useNotifications";

export function AppRoutes() {
  const dispatch = useAppDispatch();
  const { THEME, selectedTheme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  useNotifications();

  function SplashScreen() {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: THEME.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={require("@/assets/fundleaf-brand-assets/splash-mark.png")}
          resizeMode="contain"
          accessible={false}
          style={{ width: 140, height: 140, marginBottom: 24 }}
        />
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  useEffect(() => {
    // Attempt to load stored auth on app start
    void dispatch(loadUserFromStorage()).then(() => hydrateApiCache(store));
    dispatch(loadThemeFromStorage());
    // Seed the RTK Query cache with last-known month data for instant,
    // offline-friendly cold starts (revalidated against the network after).
  }, [dispatch]);

  // Only a loading session RESTORE (the user is not yet authenticated) may
  // swap the navigator for the splash screen. Once a user is authenticated, a
  // temporary loading/refetch state (e.g. Profile pull-to-refresh) must never
  // tear down the Stack — remounting a fresh navigator resets the active
  // tab/route (e.g. back to Home). Genuinely unauthenticated / session-invalid
  // users still land on the auth flow via the Stack.Screen redirect flags.
  if (isLoading && !isAuthenticated) {
    return SplashScreen();
  }

  return (
    <>
      <StatusBar
        barStyle={
          selectedTheme === "Light" || selectedTheme === "Ember"
            ? "dark-content"
            : "light-content"
        }
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" redirect={!isAuthenticated} />
        <Stack.Screen name="(auth)" redirect={isAuthenticated} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <AlertProvider>
          <BottomSheetModalProvider>
            <AppErrorBoundary>
              <Stack screenOptions={{headerShown:false}} />
            </AppErrorBoundary>
          </BottomSheetModalProvider>
        </AlertProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
