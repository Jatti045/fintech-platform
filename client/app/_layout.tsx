import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import "../global.css";
import React, { useCallback, useEffect, useState } from "react";
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
import { logoutUser, refreshAccountProfile } from "@/store/slices/userSlice";
import AuthScreen from "@/components/auth/AuthScreen";
import BrandButton from "@/components/brand/BrandButton";
import { sessionGeneration } from "@/utils/session";

export function AppRoutes() {
  const dispatch = useAppDispatch();
  const { THEME, selectedTheme } = useTheme();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isRestoring, setIsRestoring] = useState(!isAuthenticated);

  const accountStatusUnknown = isAuthenticated && typeof user?.setupComplete !== "boolean";
  const setupRequired = isAuthenticated && user?.setupComplete === false;
  const homeAllowed = isAuthenticated && user?.setupComplete === true;
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const loadAccountProfile = useCallback(async () => {
    const generation = sessionGeneration();
    setProfileLoadFailed(false);
    const action = await dispatch(refreshAccountProfile());
    if (generation === sessionGeneration() && refreshAccountProfile.rejected.match(action)) {
      setProfileLoadFailed(true);
    }
  }, [dispatch]);

  useEffect(() => {
    if (accountStatusUnknown) void loadAccountProfile();
  }, [accountStatusUnknown, user?.id, loadAccountProfile]);

  useNotifications(homeAllowed);

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
    let isMounted = true;
    // Attempt to load stored auth on app start
    void dispatch(loadUserFromStorage())
      .then((action) => {
        if (loadUserFromStorage.fulfilled.match(action) && action.payload.user.setupComplete === true) {
          return hydrateApiCache(store);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsRestoring(false);
        }
      });
    dispatch(loadThemeFromStorage());
    // Seed the RTK Query cache with last-known month data for instant,
    // offline-friendly cold starts (revalidated against the network after).
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Only a loading session RESTORE (the user is not yet authenticated) may
  // swap the navigator for the splash screen. Once a user is authenticated, a
  // temporary loading/refetch state (e.g. Profile pull-to-refresh) must never
  // tear down the Stack — remounting a fresh navigator resets the active
  // tab/route (e.g. back to Home). Genuinely unauthenticated / session-invalid
  // users still land on the auth flow via the Stack.Screen redirect flags.
  if ((isLoading || isRestoring) && !isAuthenticated) {
    return SplashScreen();
  }

  if (accountStatusUnknown) {
    if (!profileLoadFailed) return SplashScreen();
    return (
      <AuthScreen
        title="Couldn’t load your account"
        description="Check your connection and try again."
      >
        <View style={{ gap: 12 }}>
          <BrandButton label="Try again" onPress={() => void loadAccountProfile()} />
          <BrandButton label="Sign out" onPress={() => void dispatch(logoutUser())} />
        </View>
      </AuthScreen>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={
          selectedTheme === "Light"
            ? "dark-content"
            : "light-content"
        }
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" redirect={!homeAllowed} />
        <Stack.Screen name="(auth)" redirect={isAuthenticated} />
        <Stack.Screen name="account-setup" redirect={!setupRequired} />
        <Stack.Screen name="dock-preview" redirect={!homeAllowed} />
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
              <AppRoutes />
            </AppErrorBoundary>
          </BottomSheetModalProvider>
        </AlertProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
