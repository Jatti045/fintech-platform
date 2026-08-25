/**
 * Index (Home tab) integration tests.
 *
 * Verifies the refactored screen composition: homepage sections render,
 * month navigation + refresh are wired, quick actions open the right modals
 * (with the no-budget guard), and the info modal opens from the header.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertProvider } from "@/utils/themedAlert";
import transactionApi from "@/api/transaction";
import financialSummaryApi from "@/api/financialSummary";
import budgetApi from "@/api/budget";
import recurringApi from "@/api/recurring";
import Index from "@/app/(tabs)/index";
import api from "@/store/api/apiSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { TransactionType } from "@/types/transaction/types";
import type { ITransaction } from "@/types/transaction/types";
import type { IFinancialSummary } from "@/types/financialSummary/types";
import type { IBudget } from "@/types/budget/types";

const textMock = Text as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

jest.mock("@/api/transaction", () => ({
  __esModule: true,
  default: { fetchAll: jest.fn() },
}));

jest.mock("@/api/financialSummary", () => ({
  __esModule: true,
  default: { fetchSummary: jest.fn() },
}));

jest.mock("@/api/budget", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    fetchSuggestions: jest.fn(),
    applySuggestions: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/api/recurring", () => ({
  __esModule: true,
  default: {
    fetchUpcoming: jest.fn(),
  },
}));

jest.mock("@/utils/currencyConverter", () => ({
  convertCurrency: jest.fn(async (amount: number) => amount),
  getExchangeRate: jest.fn(),
  clearRatesCache: jest.fn(),
}));

const mockedTxFetch = transactionApi.fetchAll as jest.Mock;
const mockedSummaryFetch = financialSummaryApi.fetchSummary as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;
const mockedSuggestionsFetch = budgetApi.fetchSuggestions as jest.Mock;
const mockedRecurringFetch = recurringApi.fetchUpcoming as jest.Mock;

const makeTx = (overrides: Partial<ITransaction> = {}): ITransaction => ({
  id: "t-1",
  name: "Groceries run",
  month: 1,
  year: 2026,
  category: "Food",
  amount: 42,
  date: "2026-02-01T00:00:00.000Z",
  type: TransactionType.EXPENSE,
  ...overrides,
});

const makeBudget = (overrides: Partial<IBudget> = {}): IBudget => ({
  id: "b-1",
  date: new Date("2026-02-01"),
  category: "Food",
  limit: 500,
  spent: 100,
  userId: "user-1",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

const makeSummary = (
  overrides: Partial<IFinancialSummary> = {},
): IFinancialSummary => ({
  totalAmount: 100,
  monthlyIncome: 5000,
  expectedIncome: 5000,
  actualIncome: 5000,
  netSpent: 100,
  netRemaining: 4900,
  spentPercentageOfIncome: 2,
  ...overrides,
});

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });
}

async function setup(options?: { withBudgets?: boolean }) {
  const store = makeStore();
  store.dispatch(setMonthYear({ month: 1, year: 2026 }));

  mockedTxFetch.mockResolvedValue({
    data: { transaction: [makeTx()] },
  });
  mockedSummaryFetch.mockResolvedValue({ data: makeSummary() });
  mockedBudgetFetch.mockResolvedValue({
    data: options?.withBudgets ? [makeBudget()] : [],
  });

  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Index />
        </AlertProvider>
      </Provider>,
    );
  });

  // Let the initial fetch + display + conversion effects settle.
  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { tree, store };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

const refreshControlProps = () => {
  const scrollViewProps = (ScrollView as unknown as jest.Mock).mock.calls.at(
    -1,
  )?.[0];
  return scrollViewProps?.refreshControl?.props as
    | { onRefresh: () => void; refreshing: boolean }
    | undefined;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxFetch.mockReset();
  mockedSummaryFetch.mockReset();
  mockedBudgetFetch.mockReset();
  mockedSuggestionsFetch.mockReset();
  mockedRecurringFetch.mockReset();
  mockedRecurringFetch.mockResolvedValue({
    success: true,
    data: { recurringPayments: [] },
  });
  mockedSuggestionsFetch.mockResolvedValue({
    data: { year: 2026, month: 1, suggestions: [] },
  });
  textMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("Index", () => {
  it("renders the homepage sections", async () => {
    await setup({ withBudgets: true });

    expect(renderedText("Your pulse")).toBe(true);
    expect(renderedText("Recent flow")).toBe(true);
    expect(renderedText("Quick actions")).toBe(true);
  });

  it("wires the month selector to the calendar", async () => {
    const { store } = await setup();

    const prev = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Previous month",
    );
    renderer.act(() => {
      prev!.onPress();
    });

    expect(store.getState().calendar.month).toBe(0);
    expect(store.getState().calendar.year).toBe(2026);
  });

  it("refreshes the homepage data on pull-to-refresh", async () => {
    await setup();
    mockedTxFetch.mockClear();

    const refresh = refreshControlProps();
    expect(refresh).toBeDefined();

    await renderer.act(async () => {
      await refresh!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
  });

  it("opens the transaction modal when a budget exists", async () => {
    await setup({ withBudgets: true });

    const tile = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "New Transaction",
    );
    renderer.act(() => {
      tile!.onPress();
    });

    expect(renderedText("Add New Transaction")).toBe(true);
  });

  it("opens Smart Month Setup instead of the transaction modal when no budget exists", async () => {
    await setup({ withBudgets: false });

    const tile = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "New Transaction",
    );
    renderer.act(() => {
      tile!.onPress();
    });

    expect(renderedText("Add New Transaction")).toBe(false);
    expect(renderedText("Set up")).toBe(true);
  });

  it("opens the budget modal from quick actions", async () => {
    await setup();

    const tile = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "New Budget",
    );
    renderer.act(() => {
      tile!.onPress();
    });

    expect(renderedText("Create Budget")).toBe(true);
  });

  it("opens the info modal from the header", async () => {
    await setup();

    const info = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Help and usage",
    );
    renderer.act(() => {
      info!.onPress();
    });

    expect(renderedText("Help & Usage")).toBe(true);
  });
});

