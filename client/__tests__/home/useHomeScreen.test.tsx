/**
 * useHomeScreen hook tests.
 *
 * Covers homepage orchestration: initial + month-change fetching (with the
 * correct thunk parameters), refresh (cache bypass), month metadata, calendar
 * navigation, modal state, quick-action guards, display data, and currency
 * conversion (same-currency, converted, failure fallback, stale-response
 * protection).
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertProvider } from "@/utils/themedAlert";
import { convertCurrency } from "@/utils/currencyConverter";
import transactionApi from "@/api/transaction";
import financialSummaryApi from "@/api/financialSummary";
import budgetApi from "@/api/budget";
import { useHomeScreen } from "@/hooks/home/useHomeScreen";
import budgetReducer from "@/store/slices/budgetSlice";
import transactionReducerDefault from "@/store/slices/transactionSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import financialSummaryReducerDefault, {
  fetchFinancialSummary,
} from "@/store/slices/financialSummarySlice";
import themeReducer from "@/store/slices/themeSlice";
import { Text } from "react-native";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import { TransactionType } from "@/types/transaction/types";
import type { ITransaction } from "@/types/transaction/types";
import type { IFinancialSummary } from "@/types/financialSummary/types";
import type { IBudget } from "@/types/budget/types";

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
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
const mockedConvert = convertCurrency as jest.Mock;

type Home = ReturnType<typeof useHomeScreen>;

const makeTx = (overrides: Partial<ITransaction> = {}): ITransaction => ({
  id: "t-1",
  name: "Coffee",
  month: 1,
  year: 2026,
  category: "Food",
  amount: 10,
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
  totalAmount: 0,
  monthlyIncome: 0,
  expectedIncome: 0,
  actualIncome: 0,
  netSpent: 0,
  netRemaining: 0,
  spentPercentageOfIncome: 0,
  ...overrides,
});

function makeStore() {
  return configureStore({
    reducer: {
      budget: budgetReducer,
      transaction: transactionReducerDefault,
      user: userReducer,
      calendar: calendarReducer,
      financialSummary: financialSummaryReducerDefault,
      theme: themeReducer,
    },
  });
}

async function setup(seed?: (store: ReturnType<typeof makeStore>) => void) {
  const store = makeStore();
  seed?.(store);

  const captured: { current: Home | null } = { current: null };

  function Harness() {
    captured.current = useHomeScreen();
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

  // Let the fetch + display-amount + conversion effects settle.
  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { captured, store };
}

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
  await AsyncStorage.clear();
  mockedTxFetch.mockReset();
  mockedSummaryFetch.mockReset();
  mockedBudgetFetch.mockReset();
  mockedConvert.mockReset();
  mockedConvert.mockImplementation(async (amount: number) => amount);
  mockedTxFetch.mockResolvedValue({ data: { transaction: [] } });
  mockedSummaryFetch.mockResolvedValue({ data: makeSummary() });
  mockedBudgetFetch.mockResolvedValue({ data: [] });
  (Text as jest.Mock).mockClear();
});

describe("useHomeScreen", () => {
  it("fetches transactions, summary, and budgets on mount with cache-first params", async () => {
    await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });

    expect(mockedTxFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchQuery: "",
        currentMonth: 1,
        currentYear: 2026,
        page: 1,
        limit: PAGINATION_LIMIT,
      }),
    );
    expect(mockedSummaryFetch).toHaveBeenCalledWith({
      currentMonth: 1,
      currentYear: 2026,
    });
    expect(mockedBudgetFetch).toHaveBeenCalledWith({
      currentMonth: 1,
      currentYear: 2026,
    });
  });

  it("re-fetches when the month changes", async () => {
    const { store } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    renderer.act(() => {
      store.dispatch(setMonthYear({ month: 2, year: 2026 }));
    });
    await renderer.act(async () => {
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(2);
    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentMonth: 2, currentYear: 2026 }),
    );
  });

  it("refreshes all three data sources on pull-to-refresh", async () => {
    const { captured } = await setup();
    mockedTxFetch.mockClear();
    mockedSummaryFetch.mockClear();
    mockedBudgetFetch.mockClear();

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
    expect(mockedSummaryFetch).toHaveBeenCalledTimes(1);
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
  });

  it("bypasses the transaction cache when refreshing", async () => {
    // First mount fetch populates the month cache (useCache: true).
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx()] },
    });
    const { captured } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    // A cache-first fetch for the same month would return from cache without
    // hitting the API; refresh must bypass it.
    mockedTxFetch.mockClear();
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
  });

  it("derives the month label from the calendar", async () => {
    const { captured, store } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });
    const { month, year } = store.getState().calendar;
    const expected = `${new Date(year, month, 1).toLocaleString(undefined, {
      month: "long",
    })} ${year}`;

    expect(captured.current!.monthLabel).toBe(expected);
  });

  it("detects the current month", async () => {
    const current = await setup();
    expect(current.captured.current!.isCurrentMonth).toBe(true);

    const past = await setup((store) => {
      store.dispatch(setMonthYear({ month: 0, year: 2020 }));
    });
    expect(past.captured.current!.isCurrentMonth).toBe(false);
  });

  it("navigates months via handlers", async () => {
    const { captured, store } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 5, year: 2026 }));
    });

    renderer.act(() => {
      captured.current!.handlePrevMonth();
    });
    expect(store.getState().calendar.month).toBe(4);

    renderer.act(() => {
      captured.current!.handleNextMonth();
    });
    expect(store.getState().calendar.month).toBe(5);
  });

  it("manages the info / transaction / budget modal state", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.handleInfoPress();
    });
    expect(captured.current!.helpOpen).toBe(true);

    renderer.act(() => {
      captured.current!.setHelpOpen(false);
    });
    expect(captured.current!.helpOpen).toBe(false);

    renderer.act(() => {
      captured.current!.handleNewBudget();
    });
    expect(captured.current!.openBudgetModal).toBe(true);

    renderer.act(() => {
      captured.current!.setOpenBudgetModal(false);
    });
    expect(captured.current!.openBudgetModal).toBe(false);
  });


  it("exposes display transactions with display amounts", async () => {
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "USD" })] },
    });
    const { captured } = await setup();

    expect(captured.current!.displayTransactions).toHaveLength(1);
    expect(captured.current!.displayTransactions[0].displayAmount).toBe(10);
    expect(captured.current!.displayTransactions[0].displayCurrency).toBe(
      "USD",
    );
  });

  it("exposes display budgets with display amounts", async () => {
    mockedBudgetFetch.mockResolvedValue({ data: [makeBudget()] });
    const { captured } = await setup();

    expect(captured.current!.displayBudgets).toHaveLength(1);
    expect(captured.current!.displayBudgets[0].displayLimit).toBe(500);
    expect(captured.current!.displayBudgets[0].displaySpent).toBe(100);
  });

  it("exposes the monthly income from the financial summary", async () => {
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ monthlyIncome: 5000 }),
    });
    const { captured } = await setup();

    expect(captured.current!.monthlyIncome).toBe(5000);
  });

  it("opens the transaction modal when a budget exists", async () => {
    mockedBudgetFetch.mockResolvedValue({ data: [makeBudget()] });
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.handleNewTransaction();
    });

    expect(captured.current!.openTxModal).toBe(true);
  });

  it("blocks new transactions and alerts when no budget exists", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.handleNewTransaction();
    });

    expect(captured.current!.openTxModal).toBe(false);
    expect(renderedText("No budgets available")).toBe(true);
  });

  it("keeps the raw expense total when transactions share the active currency", async () => {
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "USD" })] },
    });
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 100 }),
    });
    const { captured } = await setup();

    expect(captured.current!.expenseTotal).toBe(100);
    expect(mockedConvert).not.toHaveBeenCalled();
  });

  it("converts the expense total from the inferred source currency", async () => {
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "EUR" })] },
    });
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 100 }),
    });
    mockedConvert.mockResolvedValue(130);
    const { captured } = await setup();

    expect(captured.current!.expenseTotal).toBe(130);
    expect(mockedConvert).toHaveBeenCalledWith(100, "EUR", "USD");
  });

  it("falls back to the raw total when conversion fails", async () => {
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "EUR" })] },
    });
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 100 }),
    });
    mockedConvert.mockRejectedValue(new Error("no rate"));
    const { captured } = await setup();

    expect(captured.current!.expenseTotal).toBe(100);
  });

  it("ignores a stale conversion result after the data changes", async () => {
    const deferreds: ((value: number) => void)[] = [];
    mockedConvert.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          deferreds.push(resolve);
        }),
    );
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "EUR" })] },
    });
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 100 }),
    });
    const { captured, store } = await setup();

    // The first conversion is in flight.
    expect(deferreds).toHaveLength(1);

    // New summary total triggers a second conversion; the first is cancelled.
    renderer.act(() => {
      store.dispatch({
        type: fetchFinancialSummary.fulfilled.type,
        payload: makeSummary({ totalAmount: 200 }),
      });
    });
    await renderer.act(async () => {
      await flush();
    });
    expect(deferreds).toHaveLength(2);

    // The fresh conversion wins…
    await renderer.act(async () => {
      deferreds[1](555);
      await flush();
    });
    expect(captured.current!.expenseTotal).toBe(555);

    // …and the stale one cannot overwrite it.
    await renderer.act(async () => {
      deferreds[0](999);
      await flush();
    });
    expect(captured.current!.expenseTotal).toBe(555);
  });
});

