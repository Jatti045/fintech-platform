/**
 * NotificationPreference (Purchase Reminders) – component tests.
 *
 * Verifies the toggle reflects the *effective* state: when the OS has denied
 * permission the switch is shown off and disabled (never a fake "on" toggle),
 * and an "Open Settings" action is offered. When permitted, the switch is
 * interactive.
 *
 * Uses the react-native mock (provides View/Text/Switch) with react-test-renderer.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import { Switch, Text } from "react-native";
import NotificationPreference from "@/components/profile/NotificationPreference";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import themeReducer from "@/store/slices/themeSlice";

const THEME = THEME_PALETTES.LIGHT;

// GlassPanel reads `state.theme` via useTheme(), so renders must be wrapped in
// a Redux Provider with a theme slice present.
const store = configureStore({ reducer: { theme: themeReducer } });

function renderPreference(
  overrides: Partial<React.ComponentProps<typeof NotificationPreference>> = {},
) {
  let tree: ReturnType<typeof renderer.create>;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <NotificationPreference
          THEME={THEME}
          enabled
          permissionDenied={false}
          onToggle={jest.fn()}
          onOpenSettings={jest.fn()}
          {...overrides}
        />
      </Provider>,
    );
  });
  return tree!;
}

/** Props most recently passed to the Switch host mock during render. */
function lastSwitchProps() {
  const allCalls = (Switch as jest.Mock).mock.calls;
  return allCalls[allCalls.length - 1]?.[0] as {
    disabled?: boolean;
    value?: boolean;
    onValueChange?: unknown;
  };
}

/** True if any Text host mock received the given copy as its children. */
function renderedText(matches: string) {
  return (Text as jest.Mock).mock.calls.some(
    (call) => String(call[0]?.children ?? "").includes(matches),
  );
}

const UI_TEXT =
  "A gentle nudge at 12 PM and 6 PM to log your purchases.";
const DENIED_TEXT =
  "Notifications are off for Budgee in device settings. Turn them on there to receive reminders.";
const OPEN_SETTINGS_TEXT = "Open Settings";

describe("NotificationPreference (Purchase Reminders)", () => {
  beforeEach(() => {
    (Switch as jest.Mock).mockClear();
    (Text as jest.Mock).mockClear();
  });

  it("shows an enabled, interactive switch when notifications are permitted", () => {
    renderPreference({ permissionDenied: false });

    expect(lastSwitchProps().disabled).toBeFalsy();
    expect(lastSwitchProps().value).toBe(true);
    expect(typeof lastSwitchProps().onValueChange).toBe("function");
    // Standard helper copy is shown (not the "notifications off" hint).
    expect(renderedText(UI_TEXT)).toBe(true);
    expect(renderedText(DENIED_TEXT)).toBe(false);
    expect(renderedText(OPEN_SETTINGS_TEXT)).toBe(false);
  });

  it("shows a disabled off switch and an Open Settings action when permission is denied", () => {
    renderPreference({ permissionDenied: true });

    // Never a fake "on" toggle: the switch is off and cannot be flipped here
    // because the OS must grant permission from device settings.
    expect(lastSwitchProps().disabled).toBe(true);
    expect(lastSwitchProps().value).toBe(false);
    // Guidance explains why notifications aren't being delivered, with an
    // obvious path to fix it at the system level.
    expect(renderedText(DENIED_TEXT)).toBe(true);
    expect(renderedText(UI_TEXT)).toBe(false);
    expect(renderedText(OPEN_SETTINGS_TEXT)).toBe(true);
  });
});