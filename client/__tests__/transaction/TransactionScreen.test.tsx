/**
 * TransactionScreen integration tests.
 *
 * Verifies the refactored screen still composes and wires everything:
 * header + ledger + rows render, empty state, search triggers a debounced
 * fetch, the create/edit modals open, delete shows the confirmation, and
 * pull-to-refresh refreshes transactions + budgets.
 *
 * Data flows through the mocked API modules behind the RTK Query endpoints
 * (the old transaction slice seeding is gone).
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
import financialSummaryApi from "@/api/financialSummary";
import TransactionScreen from "@/app/(tabs)/transaction";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import api from "@/store/api/apiSlice";
import {
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { TransactionType } from "@/types/transaction/types";
import type { TransactionItem } from "@/types/transaction/types";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
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

jest.mock("@/api/financialSummary", () => ({
  __esModule: true,
  default: { fetchSummary: jest.fn() },
}));

const mockedTxFetch = transactionApi.fetchAll as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;

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

const txEnvelope = (items: TransactionItem[]) => ({
  success: true,
  message: "ok",
  data: {
    transaction: items,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalCount: items.length,
      hasNextPage: false,
      hasPrevPage: false,
      limit: 20,
    },
  },
});

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

async function setup(options?: { transactions?: TransactionItem[] }) {
  // Mounting the screen subscribes to getTransactions/getBudgets; the mocked
  // API modules deliver the seed data (replaces old slice dispatches).
  mockedTxFetch.mockResolvedValue(txEnvelope(options?.transactions ?? []));

  const store = makeStore();
  store.dispatch(setMonthYear({ month: 1, year: 2026 }));

  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <TransactionScreen />
        </AlertProvider>
      </Provider>,
    );
  });

  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  // Wait for the seeded getTransactions response to land, then for the
  // display-amount render pass that turns it into rows/empty state (one
  // extra effect cycle — polling the store alone races this under load).
  await until(() => txSettled(store));
  const firstSeed = options?.transactions?.[0];
  await until(() =>
    firstSeed
      ? renderedText(String(firstSeed.name ?? ""))
      : renderedText("No transactions match filters."),
  );
  await renderer.act(async () => {
    await flush();
  });

  return { tree, store };
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
  throw new Error("timed out waiting for expected store state");
}

const txSettled = (store: { getState(): unknown }) => {
  const list = Object.values((store.getState() as any).api.queries).filter(
    (q: any) => q.endpointName === "getTransactions",
  ) as any[];
  return list.length > 0 && list.every((q) => q.status === "fulfilled");
};

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

const searchInput = () =>
  lastProps(
    textInputMock,
    (props) => props.placeholder === "Search transactions...",
  );

const refreshControlProps = () => {
  const sectionListProps = (SectionList as unknown as jest.Mock).mock.calls.at(
    -1,
  )?.[0];
  return sectionListProps?.refreshControl?.props as
    | { onRefresh: () => void; refreshing: boolean }
    | undefined;
};

const transactionRow = () =>
  lastProps(
    touchableOpacityMock,
    (props) =>
      typeof props.accessibilityLabel === "string" &&
      props.accessibilityLabel.includes("Food") &&
      props.accessibilityLabel.includes("$10.00"),
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxFetch.mockReset();
  mockedBudgetFetch.mockReset();
  mockedTxFetch.mockResolvedValue(txEnvelope([]));
  mockedBudgetFetch.mockResolvedValue({ success: true, data: [] });
  (financialSummaryApi.fetchSummary as jest.Mock).mockResolvedValue({
    success: true,
    data: { totalAmount: 0, monthlyIncome: 0, actualIncome: 0, expectedIncome: 0 },
  });
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("TransactionScreen", () => {
  it("renders the title, ledger, and transaction rows", async () => {
    await setup({
      transactions: [makeTx({ id: "a", category: "Food", amount: 10 })],
    });

    expect(renderedText("Transactions")).toBe(true);
    expect(renderedText("Spent this month")).toBe(true); // FlowHeader
    expect(renderedText("Coffee")).toBe(true); // row name
  });

  it("shows the empty state when nothing matches", async () => {
    await setup({ transactions: [] });

    expect(renderedText("No transactions match filters.")).toBe(true);
  });

  it("opens the create modal via the floating action button", async () => {
    await setup({ transactions: [makeTx()] });

    const fab = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "New Transaction",
    );
    renderer.act(() => {
      fab!.onPress();
    });

    expect(renderedText("Add New Transaction")).toBe(true);
  });

  it("opens the edit modal when a row is pressed", async () => {
    await setup({ transactions: [makeTx()] });

    renderer.act(() => {
      transactionRow()!.onPress();
    });

    expect(renderedText("Edit Transaction")).toBe(true);
  });

  it("shows the delete confirmation on long-press", async () => {
    await setup({ transactions: [makeTx()] });

    renderer.act(() => {
      transactionRow()!.onLongPress();
    });

    expect(renderedText("Delete Transaction")).toBe(true);
  });

  it("triggers a debounced search fetch when typing", async () => {
    await setup({ transactions: [makeTx()] });
    mockedTxFetch.mockClear();

    jest.useFakeTimers();
    try {
      renderer.act(() => {
        searchInput()!.onChangeText("cof");
      });
      await renderer.act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(mockedTxFetch).toHaveBeenCalledWith(
        expect.objectContaining({ searchQuery: "cof" }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("refreshes transactions and budgets on pull-to-refresh", async () => {
    await setup({ transactions: [makeTx()] });
    mockedTxFetch.mockClear();
    mockedBudgetFetch.mockClear();

    const refresh = refreshControlProps();
    expect(refresh).toBeDefined();

    await renderer.act(async () => {
      await refresh!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
  });
});
