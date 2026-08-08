/**
 * NotificationPreference (Purchase Reminders button) – component tests.
 *
 * Verifies the toggle stays interactive regardless of permission state, and
 * that the row reflects whether notifications are permitted by showing the
 * appropriate guidance copy. The switch must never be disabled, so the user
 * is never blocked from managing their preference.
 *
 * Uses the react-native mock (provides View/Text/Switch) with react-test-renderer.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";

import { Switch, Text } from "react-native";
import NotificationPreference from "@/components/profile/NotificationPreference";
import { THEME_PALETTES } from "@/constants/ThemePalettes";

const THEME = THEME_PALETTES.LIGHT;

function renderPreference(
  overrides: Partial<React.ComponentProps<typeof NotificationPreference>> = {},
) {
  let tree: ReturnType<typeof renderer.create>;
  renderer.act(() => {
    tree = renderer.create(
      <NotificationPreference
        THEME={THEME}
        enabled
        permissionDenied={false}
        onToggle={jest.fn()}
        {...overrides}
      />,
    );
  });
  return tree!;
}

/** Props most recently passed to the Switch host mock during render. */
function lastSwitchProps() {
  const allCalls = (Switch as jest.Mock).mock.calls;
  return allCalls[allCalls.length - 1]?.[0] as {
    disabled?: boolean;
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
  "Get a gentle reminder at 12&nbsp;PM and 6&nbsp;PM to log your purchases.";
const DENIED_TEXT =
  "Notifications are turned off for Budgee in your device settings, so reminders won't be delivered.";

describe("NotificationPreference (Purchase Reminders)", () => {
  beforeEach(() => {
    (Switch as jest.Mock).mockClear();
    (Text as jest.Mock).mockClear();
  });

  it("stays enabled and shows normal copy when notifications are permitted", () => {
    renderPreference({ permissionDenied: false });

    // The switch is never disabled — the user can always toggle reminders.
    // (No `disabled` prop is passed, so it's undefined/false.)
    expect(lastSwitchProps().disabled).toBeFalsy();
    expect(typeof lastSwitchProps().onValueChange).toBe("function");
    // Standard helper copy is shown (not the "notifications off" hint).
    expect(renderedText(UI_TEXT)).toBe(true);
    expect(renderedText(DENIED_TEXT)).toBe(false);
  });

  it("stays interactive but explains the situation when notifications are not permitted", () => {
    renderPreference({ permissionDenied: true });

    // Still usable — the user is never blocked from managing their preference.
    expect(lastSwitchProps().disabled).toBeFalsy();
    expect(typeof lastSwitchProps().onValueChange).toBe("function");
    // Guidance explains why notifications aren't being delivered.
    expect(renderedText(DENIED_TEXT)).toBe(true);
    expect(renderedText(UI_TEXT)).toBe(false);
  });
});