/**
 * useNotificationOnboarding hook tests.
 *
 * Covers the one-time, optional notification prompt shown after account
 * creation: it appears only when the signup flag is pending, enabling requests
 * permission and schedules reminders on grant, declining leaves reminders off
 * with a friendly message, and the flag is always cleared so the prompt is
 * never shown again.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertProvider } from "@/utils/themedAlert";
import { Text } from "react-native";
import { useNotificationOnboarding } from "@/hooks/useNotificationOnboarding";
import notificationReducer from "@/store/slices/notificationSlice";
import userReducer from "@/store/slices/userSlice";
import themeReducer from "@/store/slices/themeSlice";
import { NOTIFICATION_ONBOARDING_STORAGE_KEY } from "@/constants/notifications";
import {
  __getScheduled,
  __resetNotifications,
} from "../../__mocks__/expo-notifications";

type Onboarding = ReturnType<typeof useNotificationOnboarding>;

function setup() {
  const store = configureStore({
    reducer: {
      user: userReducer,
      notifications: notificationReducer,
      theme: themeReducer,
    },
    preloadedState: {
      user: {
        ...(userReducer(undefined, { type: "__init" }) as unknown as object),
        isAuthenticated: true,
      } as never,
      notifications: notificationReducer(undefined, {
        type: "__init",
      }) as never,
      theme: themeReducer(undefined, { type: "__init" }) as never,
    },
  });
  const captured: { current: Onboarding | null } = { current: null };

  function Harness() {
    captured.current = useNotificationOnboarding();
    return null;
  }

  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Harness />
        </AlertProvider>
      </Provider>,
    );
  });

  return { captured, store };
}

/** Lets pending microtasks (async flag reads) settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function renderedText(matches: string) {
  return (Text as jest.Mock).mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

beforeEach(async () => {
  __resetNotifications();
  (Text as jest.Mock).mockClear();
  await AsyncStorage.clear();
});

describe("useNotificationOnboarding", () => {
  it("shows the prompt when the signup flag is pending", async () => {
    await AsyncStorage.setItem(NOTIFICATION_ONBOARDING_STORAGE_KEY, "1");
    const { captured } = setup();
    await flush();
    expect(captured.current!.visible).toBe(true);
  });

  it("does not show the prompt without the pending flag", async () => {
    const { captured } = setup();
    await flush();
    expect(captured.current!.visible).toBe(false);
  });

  it("enables reminders and clears the flag when accepted and permission is granted", async () => {
    await AsyncStorage.setItem(NOTIFICATION_ONBOARDING_STORAGE_KEY, "1");
    const { captured, store } = setup();
    await flush();
    expect(captured.current!.visible).toBe(true);

    await renderer.act(async () => {
      await captured.current!.handleEnable();
    });

    expect(store.getState().notifications.purchaseRemindersEnabled).toBe(true);
    expect(
      await AsyncStorage.getItem(NOTIFICATION_ONBOARDING_STORAGE_KEY),
    ).toBeNull();
    expect(captured.current!.visible).toBe(false);
    expect(__getScheduled().length).toBeGreaterThan(0);
  });

  it("leaves reminders off and shows the friendly message when declined", async () => {
    await AsyncStorage.setItem(NOTIFICATION_ONBOARDING_STORAGE_KEY, "1");
    const { captured, store } = setup();
    await flush();

    await renderer.act(async () => {
      await captured.current!.handleDecline();
    });

    expect(store.getState().notifications.purchaseRemindersEnabled).toBe(false);
    expect(
      await AsyncStorage.getItem(NOTIFICATION_ONBOARDING_STORAGE_KEY),
    ).toBeNull();
    expect(captured.current!.visible).toBe(false);
    expect(renderedText("No problem")).toBe(true);
    expect(__getScheduled().length).toBe(0);
  });
});
