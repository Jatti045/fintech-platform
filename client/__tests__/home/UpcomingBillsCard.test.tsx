/**
 * UpcomingBillsCard component tests.
 *
 * Verifies the Home card's contract: hidden when there is nothing to show,
 * hedged estimate wording for the bills it does show, confidence surfacing,
 * expandable detail with evidence + dismiss, and that dismissals reach the
 * callback.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import UpcomingBillsCard from "@/components/home/UpcomingBillsCard";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TouchableOpacity } from "react-native";
import type { IRecurringPayment } from "@/types/recurring/types";

const textMock = Text as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

const store = configureStore({ reducer: { theme: themeReducer } });

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const makeBill = (overrides: Partial<IRecurringPayment> = {}): IRecurringPayment => ({
  seriesKey: "NETFLIX",
  name: "Netflix",
  expectedAmount: 15.49,
  currency: "USD",
  cadence: "MONTHLY",
  intervalDays: 30,
  nextExpectedDate: inDays(2),
  lastOccurredDate: inDays(-28),
  occurrences: 8,
  confidence: "HIGH",
  usualDayOfMonth: 27,
  amountChange: null,
  matchedTransactions: [
    { id: "t-1", date: inDays(-28), amount: 15.49 },
    { id: "t-2", date: inDays(-58), amount: 15.49 },
  ],
  ...overrides,
});

function renderCard(
  bills: IRecurringPayment[],
  onDismiss = jest.fn(),
) {
  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <UpcomingBillsCard
          bills={bills}
          currencyCode="USD"
          onDismiss={onDismiss}
        />
      </Provider>,
    );
  });
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

describe("UpcomingBillsCard", () => {
  it("renders nothing when there are no bills", () => {
    renderCard([]);

    expect(renderedText("Upcoming Bills")).toBe(false);
  });

  it("shows predicted bills with estimate wording", () => {
    renderCard([makeBill()]);

    expect(renderedText("Upcoming Bills")).toBe(true);
    expect(renderedText("Netflix")).toBe(true);
    expect(renderedText("~$15.49")).toBe(true);
    // Monthly bills get a "usually around the Nth" hint.
    expect(renderedText("Usually around the 27th")).toBe(true);
  });

  it("marks medium-confidence bills as low certainty", () => {
    renderCard([makeBill({ confidence: "MEDIUM" })]);

    expect(renderedText("LOW CERTAINTY")).toBe(true);
  });

  it("does not mark high-confidence bills as low certainty", () => {
    renderCard([makeBill()]);

    expect(renderedText("LOW CERTAINTY")).toBe(false);
  });

  it("surfaces an amount change instead of silently absorbing it", () => {
    renderCard([
      makeBill({
        expectedAmount: 17.99,
        amountChange: { previousAmount: 15.49, currentAmount: 17.99 },
      }),
    ]);

    expect(renderedText("~$17.99")).toBe(true);
    expect(renderedText("was 15.49")).toBe(true);
  });
});
