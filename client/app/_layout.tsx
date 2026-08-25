import "../global.css";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store, loadUserFromStorage, useAuth } from "../store";
import { useEffect } from "react";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { ActivityIndicator, View } from "react-native";
import { loadThemeFromStorage } from "@/store/slices/themeSlice";
import { hydrateApiCache } from "@/store/api/cachePersistence";
import { AlertProvider } from "@/utils/themedAlert";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AppErrorBoundary from "@/components/global/AppErrorBoundary";
import { useNotifications } from "@/hooks/useNotifications";

function AppRoutes() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
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
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  useEffect(() => {
    // Attempt to load stored auth on app start
    dispatch(loadUserFromStorage());
    dispatch(loadThemeFromStorage());
    // Seed the RTK Query cache with last-known month data for instant,
    // offline-friendly cold starts (revalidated against the network after).
    void hydrateApiCache(store);
  }, [dispatch]);

  if (isLoading) {
    return SplashScreen();
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" redirect={!isAuthenticated} />
      <Stack.Screen name="(auth)" redirect={isAuthenticated} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <AlertProvider>
          <AppErrorBoundary>
            <AppRoutes />
          </AppErrorBoundary>
        </AlertProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
