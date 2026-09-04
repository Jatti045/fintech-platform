/**
 * MonthlyInsightCard component tests.
 *
 * Verifies the "✨ Explain my month" card's contract: the action renders, the
 * lazy query fires with the currently selected month, the loading state is
 * shown, the explanation renders (summary + highlights), and provider failures
 * degrade to an inline error without breaking the card.
 */

/// <reference types="jest" />

import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import MonthlyInsightCard from "@/components/home/MonthlyInsightCard";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TouchableOpacity } from "react-native";

const textMock = Text as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

const fetchInsightMock = jest.fn();

jest.mock("@/store/api/apiSlice", () => ({
  useLazyGetMonthlyInsightQuery: () => [
    (args: { currentMonth: number; currentYear: number }) => {
      fetchInsightMock(args);
      return Promise.resolve({ data: undefined, error: undefined });
    },
    {
      data: state.data,
      error: state.error,
      isLoading: state.loading,
      isFetching: state.loading,
      reset: jest.fn(),
    },
  ],
}));

/** Controllable hook state the mock reads on each render. */
const state = {
  data: undefined as any,
  error: undefined as any,
  loading: false,
};

const store = configureStore({ reducer: { theme: themeReducer } });

type RenderOptions = {
  data?: any;
  error?: any;
  loading?: boolean;
};

function renderCard(options: RenderOptions = {}) {
  state.data = options.data;
  state.error = options.error;
  state.loading = options.loading ?? false;

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <MonthlyInsightCard month={8} year={2026} />
      </Provider>,
    );
  });
  return tree;
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

function findPressables(tree: renderer.ReactTestRenderer) {
  const presses: (() => void)[] = [];
  tree.root.findAll((node) => node.props?.onPress != null).forEach((node) => {
    presses.push(node.props.onPress);
  });
  return presses;
}

beforeEach(() => {
  textMock.mockClear();
  touchableOpacityMock.mockClear();
  fetchInsightMock.mockClear();
  state.data = undefined;
  state.error = undefined;
  state.loading = false;
});

describe("MonthlyInsightCard", () => {
  it("renders the Explain my month action", () => {
    renderCard();

    expect(renderedText("Explain my month")).toBe(true);
  });

  it("requests the currently selected month when tapped", () => {
    const tree = renderCard();
    const presses = findPressables(tree);

    act(() => {
      presses[0]();
    });

    expect(fetchInsightMock).toHaveBeenCalledWith({
      currentMonth: 8,
      currentYear: 2026,
    });
  });

  it("shows the loading state while generating", () => {
    renderCard({ loading: true });

    expect(renderedText("Generating your explanation")).toBe(true);
    expect(renderedText("Explain my month")).toBe(false);
  });

  it("renders the generated explanation with highlights", () => {
    renderCard({
      data: {
        year: 2026,
        month: 8,
        currency: "USD",
        insufficientData: false,
        summary: "Your spending is up 14% this month, mainly restaurants.",
        highlights: ["Restaurants +32%", "Entertainment budget 91% used"],
      },
    });

    expect(renderedText("Your month")).toBe(true);
    expect(renderedText("Your spending is up 14% this month")).toBe(true);
    expect(renderedText("Restaurants +32%")).toBe(true);
    expect(renderedText("Entertainment budget 91% used")).toBe(true);
  });

  it("renders the deterministic insufficient-data message", () => {
    renderCard({
      data: {
        year: 2026,
        month: 8,
        currency: "USD",
        insufficientData: true,
        summary:
          "There's not enough activity this month to generate a meaningful explanation yet.",
        highlights: [],
      },
    });

    expect(
      renderedText("not enough activity this month"),
    ).toBe(true);
  });

  it("shows an inline error on provider failure without crashing", () => {
    renderCard({ error: { status: "CUSTOM_ERROR", error: "boom" } });

    expect(
      renderedText("Couldn't generate your monthly explanation right now."),
    ).toBe(true);
    expect(renderedText("Try again")).toBe(true);
  });
});
