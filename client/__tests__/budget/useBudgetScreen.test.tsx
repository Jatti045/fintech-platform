/**
 * useBudgetScreen hook tests.
 *
 * Covers the screen-level orchestration: search filtering, unbudgeted vs
 * budgeted classification, selected-budget behavior (including fallback when
 * the selection disappears), month label, initial-loading flag, modal state,
 * and pull-to-refresh.
 *
 * Budgets are delivered by the mocked budget API behind the RTK Query
 * `getBudgets` endpoint (the old budgetSlice seeding is gone).
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import budgetApi from "@/api/budget";
import transactionApi from "@/api/transaction";
import { useBudgetScreen } from "@/hooks/budget/useBudgetScreen";
import userReducer from "@/store/slices/userSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import api from "@/store/api/apiSlice";
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

jest.mock("@/api/transaction", () => ({
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

/**
 * Resolves on demand, with a safety timeout so a pending gate can never wedge
 * the suite (the display-amounts effect keeps re-running while a budget
 * query is pending).
 */
function gatedResponse(value: any, safetyMs = 500) {
  let resolveNow!: (v: any) => void;
  const timer = setTimeout(() => resolveNow(value), safetyMs);
  const promise = new Promise<any>((res) => {
    resolveNow = (v: any) => {
      clearTimeout(timer);
      res(v);
    };
  });
  return { promise, resolve: resolveNow };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Repeatedly act-flushes until the predicate holds (RTKQ fulfillment is async). */
async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    let ok = false;
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      ok = pred();
    });
    if (ok) return;
  }
  throw new Error("timed out waiting for expected store/hook state");
}

const budgetsSettled = (store: { getState(): unknown }) => {
  const list = Object.values((store.getState() as any).api.queries).filter(
    (q: any) => q.endpointName === "getBudgets",
  ) as any[];
  return list.length > 0 && list.every((q) => q.status === "fulfilled");
};

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });
}

async function setup(
  initialBudgets: IBudget[] = [],
  options: { awaitData?: boolean } = {},
) {
  // Mounting the hook subscribes to getBudgets; the mocked API delivers the
  // seed data (replaces old fetchBudgets.fulfilled dispatches).
  if (!mockedFetchAll.getMockImplementation()) {
    mockedFetchAll.mockResolvedValue({ success: true, data: initialBudgets });
  }

  const store = makeStore();
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

  if (options.awaitData !== false) {
    // Wait for the seeded budgets, then one extra turn for the display-
    // amounts effect.
    await until(() => budgetsSettled(store));
    await renderer.act(async () => {
      await flush();
    });
  }

  return { captured, store };
}


beforeEach(() => {
  mockedFetchAll.mockReset();
  (transactionApi.fetchAll as jest.Mock).mockReset();
  // The screen hook also subscribes to transactions for display amounts.
  (transactionApi.fetchAll as jest.Mock).mockResolvedValue({
    success: true,
    data: { transaction: [] },
  });
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
    // An in-flight fetch keeps budgetsQuery.isFetching true — the RTKQ
    // equivalent of the old `fetchBudgets.pending` dispatch (bounded via
    // gate/safety-timeout; see gatedResponse).
    const gate = gatedResponse({ success: true, data: [] });
    mockedFetchAll.mockReturnValue(gate.promise);
    const loading = await setup([], { awaitData: false });
    expect(loading.captured.current!.isInitialLoading).toBe(true);

    renderer.act(() => {
      gate.resolve({ success: true, data: [] });
    });
    await until(() => budgetsSettled(loading.store));

    // Loading while budgets are already shown must NOT flag initial loading:
    // deliver data first, then hang a refetch.
    const refetchGate = gatedResponse({ success: true, data: [makeBudget()] });
    mockedFetchAll
      .mockResolvedValueOnce({ success: true, data: [makeBudget()] })
      .mockReturnValueOnce(refetchGate.promise);
    const withBudgets = await setup([makeBudget()]);
    let refreshPromise!: Promise<void>;
    renderer.act(() => {
      refreshPromise = withBudgets.captured.current!.onRefresh();
    });
    expect(withBudgets.captured.current!.isInitialLoading).toBe(false);

    renderer.act(() => {
      refetchGate.resolve({ success: true, data: [makeBudget()] });
    });
    await renderer.act(async () => {
      await refreshPromise;
      await flush();
    });
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

  it("refetches budgets for the current calendar on refresh", async () => {
    mockedFetchAll.mockResolvedValue({ success: true, data: [] });
    const { captured, store } = await setup();
    const { month, year } = store.getState().calendar;
    mockedFetchAll.mockClear();

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
