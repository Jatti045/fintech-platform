/**
 * useBudgetScreen hook tests.
 *
 * Covers the screen-level orchestration: search filtering, unbudgeted vs
 * budgeted classification, selected-budget behavior (including fallback when
 * the selection disappears), month label, initial-loading flag, modal state,
 * and pull-to-refresh.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import budgetApi from "@/api/budget";
import { useBudgetScreen } from "@/hooks/budget/useBudgetScreen";
import budgetReducer, { fetchBudgets } from "@/store/slices/budgetSlice";
import transactionReducerDefault from "@/store/slices/transactionSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import type { IBudget } from "@/types/budget/types";

jest.mock("@/api/budget", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedFetchAll = budgetApi.fetchAll as jest.Mock;

type Screen = ReturnType<typeof useBudgetScreen>;

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

function makeStore() {
  return configureStore({
    reducer: {
      budget: budgetReducer,
      transaction: transactionReducerDefault,
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
    },
  });
}

async function setup(
  initialBudgets: IBudget[] = [],
  seed?: (store: ReturnType<typeof makeStore>) => void,
) {
  const store = makeStore();
  if (initialBudgets.length > 0) {
    store.dispatch({
      type: fetchBudgets.fulfilled.type,
      payload: initialBudgets,
    });
  }
  seed?.(store);

  const captured: { current: Screen | null } = { current: null };

  function Harness() {
    captured.current = useBudgetScreen();
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

  // Let the display-amounts async effect settle.
  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { captured, store };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockedFetchAll.mockReset();
});

describe("useBudgetScreen", () => {
  it("filters budgets by the search query", async () => {
    const { captured } = await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    renderer.act(() => {
      captured.current!.setSearchQuery("Foo");
    });

    expect(captured.current!.isSearching).toBe(true);
    expect(captured.current!.filteredBudgets.map((b) => b.id)).toEqual(["a"]);
  });

  it("returns all budgets for an empty search", async () => {
    const { captured } = await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    renderer.act(() => {
      captured.current!.setSearchQuery("");
    });

    expect(captured.current!.filteredBudgets).toHaveLength(2);
    expect(captured.current!.isSearching).toBe(false);
  });

  it("classifies auto-created and zero-limit-with-spend budgets as unbudgeted", async () => {
    const { captured } = await setup([
      makeBudget({ id: "a", category: "Plaid", autoCreated: true }),
      makeBudget({ id: "b", category: "Zero", limit: 0, spent: 40 }),
      makeBudget({ id: "c", category: "Food" }),
    ]);

    expect(captured.current!.unbudgetedBudgets.map((b) => b.id)).toEqual([
      "a",
      "b",
    ]);
    expect(captured.current!.budgetedBudgets.map((b) => b.id)).toEqual(["c"]);
  });

  it("defaults the selected budget to the first visible budget", async () => {
    const { captured } = await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    expect(captured.current!.selectedBudget?.id).toBe("a");
  });

  it("follows the budget tapped via handleToggle", async () => {
    const { captured } = await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    renderer.act(() => {
      captured.current!.handleToggle(captured.current!.filteredBudgets[1]);
    });

    expect(captured.current!.selectedBudget?.id).toBe("b");
  });

  it("falls back to the first visible budget when the selection is filtered out", async () => {
    const { captured } = await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    renderer.act(() => {
      captured.current!.handleToggle(captured.current!.filteredBudgets[1]);
    });
    expect(captured.current!.selectedBudget?.id).toBe("b");

    renderer.act(() => {
      captured.current!.setSearchQuery("food");
    });

    expect(captured.current!.filteredBudgets.map((b) => b.id)).toEqual(["a"]);
    expect(captured.current!.selectedBudget?.id).toBe("a");
  });

  it("derives the month label from the calendar state", async () => {
    const { captured, store } = await setup();
    const { month, year } = store.getState().calendar;
    const expected = new Date(year, month, 1).toLocaleString(undefined, {
      month: "long",
    });

    expect(captured.current!.monthLabel).toBe(expected);
  });

  it("flags initial loading only when loading with no budgets yet", async () => {
    const loading = await setup([], (store) => {
      store.dispatch({ type: fetchBudgets.pending.type });
    });
    expect(loading.captured.current!.isInitialLoading).toBe(true);

    const withBudgets = await setup([makeBudget()], (store) => {
      store.dispatch({ type: fetchBudgets.pending.type });
    });
    expect(withBudgets.captured.current!.isInitialLoading).toBe(false);
  });

  it("manages the create/edit modal state", async () => {
    const { captured } = await setup([makeBudget()]);

    renderer.act(() => {
      captured.current!.handleNewBudget();
    });
    expect(captured.current!.openSheet).toBe(true);
    expect(captured.current!.editingBudget).toBeNull();

    renderer.act(() => {
      captured.current!.handleEditPress(makeBudget({ id: "b" }));
    });
    expect(captured.current!.openSheet).toBe(true);
    expect(captured.current!.editingBudget?.id).toBe("b");

    renderer.act(() => {
      captured.current!.handleModalClose();
    });
    expect(captured.current!.openSheet).toBe(false);
    expect(captured.current!.editingBudget).toBeNull();
  });

  it("dispatches fetchBudgets for the current calendar on refresh", async () => {
    mockedFetchAll.mockResolvedValue({ data: [] });
    const { captured, store } = await setup();
    const { month, year } = store.getState().calendar;

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedFetchAll).toHaveBeenCalledWith({
      currentMonth: month,
      currentYear: year,
    });
  });
});

