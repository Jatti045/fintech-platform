/**
 * BudgetHeader component tests.
 *
 * Pure presentation: title/subtitle, the month badge, and the search bar
 * (shown only once budgets exist). Search state lives in `useBudgetScreen`.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import BudgetHeader from "@/components/budget/BudgetHeader";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TextInput } from "react-native";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;

const store = configureStore({ reducer: { theme: themeReducer } });

type Props = React.ComponentProps<typeof BudgetHeader>;

function renderHeader(overrides: Partial<Props> = {}) {
  const props: Props = {
    monthLabel: "February",
    showSearch: true,
    searchQuery: "",
    onSearchChange: jest.fn(),
    ...overrides,
  };

  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <BudgetHeader {...props} />
      </Provider>,
    );
  });

  return { props };
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
  textInputMock.mockClear();
});

describe("BudgetHeader", () => {
  it("renders the title, subtitle, and month label", () => {
    renderHeader({ monthLabel: "March" });

    expect(renderedText("Budgets")).toBe(true);
    expect(renderedText("Your monthly flow, one dial")).toBe(true);
    expect(renderedText("March")).toBe(true);
  });

  it("renders the search bar when budgets exist", () => {
    renderHeader({ showSearch: true });

    expect(
      lastProps(
        textInputMock,
        (props) => props.placeholder === "Search budgets...",
      ),
    ).toBeDefined();
  });

  it("hides the search bar before budgets exist", () => {
    renderHeader({ showSearch: false });

    expect(
      lastProps(
        textInputMock,
        (props) => props.placeholder === "Search budgets...",
      ),
    ).toBeUndefined();
  });

  it("forwards search changes to the callback", () => {
    const { props } = renderHeader();

    const input = lastProps(
      textInputMock,
      (props) => props.placeholder === "Search budgets...",
    );
    renderer.act(() => {
      input!.onChangeText("food");
    });

    expect(props.onSearchChange).toHaveBeenCalledWith("food");
  });
});
