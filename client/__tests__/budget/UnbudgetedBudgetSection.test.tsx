/**
 * UnbudgetedBudgetSection component tests.
 *
 * Renders the auto-created / zero-limit categories with their display amounts
 * and a "Set Limit" action that opens the edit modal via the callback.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import UnbudgetedBudgetSection from "@/components/budget/UnbudgetedBudgetSection";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TouchableOpacity } from "react-native";
import type { DisplayBudget } from "@/types/budget/types";

const textMock = Text as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

const store = configureStore({ reducer: { theme: themeReducer } });

const makeDisplayBudget = (
  overrides: Partial<DisplayBudget> = {},
): DisplayBudget => ({
  id: "b-1",
  date: new Date("2026-02-01"),
  category: "Food",
  limit: 0,
  spent: 40,
  userId: "user-1",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  displayLimit: 0,
  displaySpent: 40,
  displayCurrency: "USD",
  ...overrides,
});

function renderSection(
  budgets: DisplayBudget[],
  onSetLimit = jest.fn(),
) {
  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <UnbudgetedBudgetSection
          budgets={budgets}
          onSetLimit={onSetLimit}
        />
      </Provider>,
    );
  });
  return { onSetLimit };
}

function lastProps(
  mock: jest.Mock,
  matcher: (props: Record<string, unknown>) => boolean,
): Record<string, any> | undefined {
  const calls = mock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && matcher(props)) return props;
  }
  return undefined;
}

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

beforeEach(() => {
  textMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("UnbudgetedBudgetSection", () => {
  it("renders each unbudgeted category with its spent amount", () => {
    renderSection([
      makeDisplayBudget({ id: "a", category: "Plaid" }),
      makeDisplayBudget({
        id: "b",
        category: "Transport",
        displaySpent: 25,
      }),
    ]);

    expect(renderedText("Plaid")).toBe(true);
    expect(renderedText("Transport")).toBe(true);
    expect(renderedText("Spent $40.00 — no limit")).toBe(true);
    expect(renderedText("Spent $25.00 — no limit")).toBe(true);
  });

  it("renders the limit portion when a display limit exists", () => {
    renderSection([
      makeDisplayBudget({ displayLimit: 100, displaySpent: 30 }),
    ]);

    expect(renderedText("Spent $30.00 of $100.00")).toBe(true);
  });

  it("triggers onSetLimit with the tapped budget", () => {
    const budget = makeDisplayBudget({ id: "a", category: "Plaid" });
    const { onSetLimit } = renderSection([budget]);

    const button = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Set limit for Plaid",
    );
    renderer.act(() => {
      button!.onPress();
    });

    expect(onSetLimit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
    );
  });

  it("exposes a descriptive accessibility label per budget", () => {
    renderSection([makeDisplayBudget({ category: "Food" })]);

    expect(
      lastProps(
        touchableOpacityMock,
        (props) => props.accessibilityLabel === "Set limit for Food",
      ),
    ).toBeDefined();
  });
});
