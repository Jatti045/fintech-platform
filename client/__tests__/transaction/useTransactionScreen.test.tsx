/**
 * useTransactionScreen hook tests.
 *
 * Covers the orchestration moved out of the Transactions screen: initial
 * loading / empty state, search + search-clear skeleton suppression, filter
 * loader coordination, selected budget / min / max normalization, pull-to-
 * refresh, load-more wiring, edit/delete handlers, and loader messages.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertProvider } from "@/utils/themedAlert";
import transactionApi from "@/api/transaction";
import budgetApi from "@/api/budget";
import { useTransactionScreen } from "@/hooks/transaction/useTransactionScreen";
import budgetReducer from "@/store/slices/budgetSlice";
import transactionReducerDefault, {
  createTransaction,
  deleteTransaction,
  fetchTransaction,
  updateTransaction,
} from "@/store/slices/transactionSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import financialSummaryReducerDefault from "@/store/slices/financialSummarySlice";
import themeReducer from "@/store/slices/themeSlice";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { TransactionType } from "@/types/transaction/types";
import type { TransactionItem } from "@/types/transaction/types";

const textMock = Text as unknown as jest.Mock;
const activityIndicatorMock = ActivityIndicator as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

jest.mock("@/api/transaction", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
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

const mockedTxFetch = transactionApi.fetchAll as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;

type Screen = ReturnType<typeof useTransactionScreen>;

const makeTx = (overrides: Partial<TransactionItem> = {}): TransactionItem => ({
  id: "t-1",
  name: "Coffee",
  amount: 10,
  date: "2026-02-10T09:00:00.000Z",
  category: "Food",
  baseCurrency: "USD",
  type: TransactionType.EXPENSE,
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

  const captured: { current: Screen | null } = { current: null };

  function Harness() {
    captured.current = useTransactionScreen();
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

  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { captured, store };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

function seedTransactions(
  store: ReturnType<typeof makeStore>,
  transactions: TransactionItem[],
  pagination?: Partial<{
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }>,
) {
  store.dispatch({
    type: fetchTransaction.fulfilled.type,
    payload: {
      transaction: transactions,
      pagination: {
        currentPage: pagination?.currentPage ?? 1,
        totalPages: pagination?.totalPages ?? 1,
        totalCount: pagination?.totalCount ?? transactions.length,
        hasNextPage: pagination?.hasNextPage ?? false,
        hasPrevPage: pagination?.hasPrevPage ?? false,
      },
    },
  });
}

function touchableContainsText(children: unknown, text: string): boolean {
  if (typeof children === "string") return children.includes(text);
  if (Array.isArray(children)) {
    return children.some((child) => touchableContainsText(child, text));
  }
  if (React.isValidElement(children)) {
    // Only walk props.children — never _owner (which can be circular).
    const elementChildren = (children.props as { children?: unknown }).children;
    return touchableContainsText(elementChildren, text);
  }
  return false;
}

function lastTouchableContaining(text: string) {
  const calls = touchableOpacityMock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && touchableContainsText(props.children, text)) {
      return props;
    }
  }
  return undefined;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxFetch.mockReset();
  mockedBudgetFetch.mockReset();
  textMock.mockClear();
  activityIndicatorMock.mockClear();
  touchableOpacityMock.mockClear();
  mockedTxFetch.mockResolvedValue({ data: { transaction: [] } });
  mockedBudgetFetch.mockResolvedValue({ data: [] });
});


describe("useTransactionScreen", () => {
  it("shows the initial-loading spinner, then the empty state", async () => {
    const { captured, store } = await setup();

    renderer.act(() => {
      store.dispatch({ type: fetchTransaction.pending.type });
    });
    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(activityIndicatorMock.mock.calls.length).toBeGreaterThan(0);

    renderer.act(() => {
      seedTransactions(store, []);
    });
    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(renderedText("No transactions match filters.")).toBe(true);
  });

  it("tracks search state and arms skeleton suppression when clearing", async () => {
    const { captured, store } = await setup();

    renderer.act(() => {
      captured.current!.handleSearchQueryChange("coffee");
    });
    expect(captured.current!.searchQuery).toBe("coffee");
    expect(captured.current!.isSearching).toBe(true);

    // While a clear-search fetch is still loading, the initial skeleton must
    // stay suppressed (no spinner in listEmpty).
    renderer.act(() => {
      store.dispatch({ type: fetchTransaction.pending.type });
    });
    renderer.act(() => {
      captured.current!.handleSearchQueryChange("");
    });
    expect(captured.current!.searchQuery).toBe("");
    expect(captured.current!.isSearching).toBe(false);

    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(activityIndicatorMock.mock.calls.length).toBe(0);
  });

  it("shows the filtering loader and clears it after the fetch completes", async () => {
    const { captured, store } = await setup();

    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-1");
    });
    expect(captured.current!.isFiltering).toBe(true);
    expect(captured.current!.loaderMessage).toBe("Filtering transactions…");
    expect(captured.current!.isLoaderVisible).toBe(true);

    // fetch starts → saw-loading, then completes → rAF clears the loader.
    renderer.act(() => {
      store.dispatch({ type: fetchTransaction.pending.type });
    });
    renderer.act(() => {
      seedTransactions(store, [makeTx()]);
    });
    await renderer.act(async () => {
      await flush();
    });

    expect(captured.current!.isFiltering).toBe(false);
    expect(captured.current!.loaderMessage).toBe("");
  });

  it("normalizes selected budget/min/max and passes them to the refresh fetch", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-1");
      captured.current!.setMinAmount("10");
      captured.current!.setMaxAmount("20");
    });
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        budgetId: "b-1",
        minAmount: 10,
        maxAmount: 20,
      }),
    );
  });

  it("treats a blank min/max as null and a non-numeric as zero", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.setMinAmount("");
      captured.current!.setMaxAmount("abc");
    });
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ minAmount: null, maxAmount: 0 }),
    );
  });

  it("refreshes transactions and budgets together", async () => {
    const { captured } = await setup();
    mockedTxFetch.mockClear();
    mockedBudgetFetch.mockClear();

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
  });

  it("wires the footer load-more action to fetch the next page", async () => {
    const { captured, store } = await setup((store) => {
      seedTransactions(store, [makeTx()], {
        hasNextPage: true,
        totalPages: 2,
        totalCount: 1,
      });
    });
    mockedTxFetch.mockClear();

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>{captured.current!.listFooter}</Provider>,
      );
    });
    void tree;

    const loadMore = lastTouchableContaining("Load More Transactions");
    expect(loadMore).toBeDefined();
    renderer.act(() => {
      loadMore!.onPress();
    });
    await renderer.act(async () => {
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("opens the edit modal and clears editing on close", async () => {
    const { captured } = await setup();
    const tx = makeTx();

    const row = captured.current!.renderItem({ item: tx });
    renderer.act(() => {
      row.props.onEdit(tx);
    });
    expect(captured.current!.openSheet).toBe(true);
    expect(captured.current!.editingTransaction?.id).toBe("t-1");

    renderer.act(() => {
      captured.current!.handleModalClose();
    });
    expect(captured.current!.editingTransaction).toBeNull();
  });

  it("wires the row delete action to the confirmation prompt", async () => {
    const { captured } = await setup();
    const tx = makeTx({ id: "t-9", name: "Ride", category: "Transport" });

    const row = captured.current!.renderItem({ item: tx });
    renderer.act(() => {
      row.props.onDelete(tx.id);
    });

    expect(renderedText("Delete Transaction")).toBe(true);
  });

  it("selects the correct loader message for each operation", async () => {
    const { captured, store } = await setup();

    renderer.act(() => {
      store.dispatch({ type: createTransaction.pending.type });
    });
    expect(captured.current!.loaderMessage).toBe("Adding transaction…");
    expect(captured.current!.isLoaderVisible).toBe(true);
    renderer.act(() => {
      store.dispatch({
        type: createTransaction.fulfilled.type,
        payload: { data: makeTx() },
      });
    });

    renderer.act(() => {
      store.dispatch({ type: updateTransaction.pending.type });
    });
    expect(captured.current!.loaderMessage).toBe("Updating transaction…");
    renderer.act(() => {
      store.dispatch({
        type: updateTransaction.fulfilled.type,
        payload: {},
      });
    });

    renderer.act(() => {
      store.dispatch({ type: deleteTransaction.pending.type });
    });
    expect(captured.current!.loaderMessage).toBe("Deleting transaction…");
  });

  it("groups seeded transactions into sections and exposes render callbacks", async () => {
    const { captured } = await setup((store) => {
      seedTransactions(store, [
        makeTx({ id: "a", date: "2026-02-10T09:00:00.000Z" }),
        makeTx({ id: "b", date: "2026-02-10T18:00:00.000Z" }),
      ]);
    });

    expect(captured.current!.sectionsWithTotals).toHaveLength(1);
    expect(captured.current!.sectionsWithTotals[0].data).toHaveLength(2);
    expect(captured.current!.sectionsWithTotals[0].total).toBe(20);

    const header = captured.current!.renderSectionHeader({
      section: captured.current!.sectionsWithTotals[0],
    });
    expect(React.isValidElement(header)).toBe(true);

    const row = captured.current!.renderItem({ item: makeTx() });
    expect(React.isValidElement(row)).toBe(true);

    expect(captured.current!.keyExtractor(makeTx({ id: "abc" }), 0)).toBe(
      "abc",
    );
    expect(captured.current!.keyExtractor(makeTx({ id: undefined }), 3)).toBe(
      "3",
    );
  });
});

