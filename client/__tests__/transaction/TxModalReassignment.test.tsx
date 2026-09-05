/**
 * TxModalReassignment regression tests.
 *
 * Covers:
 * 1. Budget reassignment sends both budgetId and category in update payload,
 *    and closes modal on success.
 * 2. Fallback normalization: correctly reads initial budget from either top-level
 *    budgetId or nested budget.id.
 * 3. Failure feedback & state preservation: keeps modal open, preserves form
 *    values (name, amount, budget), and surfaces user-friendly alert when update fails.
 * 4. Editing other fields (name, amount, date) works correctly without unexpected
 *    side-effects on budget.
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
import TransactionModal from "@/components/transaction/TxModal";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import api from "@/store/api/apiSlice";
import { Text, TextInput, TouchableOpacity } from "react-native";
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

const mockedTxUpdate = transactionApi.update as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;

const mockBudgets = [
  { id: "b-groceries", category: "Groceries", allocatedAmount: 500, spentAmount: 100 },
  { id: "b-shopping", category: "Shopping", allocatedAmount: 300, spentAmount: 50 },
];

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

function touchableContainsText(children: unknown, text: string): boolean {
  if (typeof children === "string") return children.includes(text);
  if (Array.isArray(children)) {
    return children.some((child) => touchableContainsText(child, text));
  }
  if (React.isValidElement(children)) {
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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    let ok = false;
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      ok = pred();
    });
    if (ok) return;
  }
  throw new Error("timed out waiting for condition");
}

const nameInput = () =>
  lastProps(
    textInputMock,
    (props) => props.accessibilityLabel === "Transaction name",
  );

const amountInput = () =>
  lastProps(
    textInputMock,
    (props) => props.accessibilityLabel === "Transaction amount",
  );

const nextDayButton = () =>
  lastProps(
    touchableOpacityMock,
    (props) => props.accessibilityLabel === "Next day",
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxUpdate.mockReset();
  mockedBudgetFetch.mockReset();
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();

  mockedBudgetFetch.mockResolvedValue({
    success: true,
    data: mockBudgets,
  });

  (financialSummaryApi.fetchSummary as jest.Mock).mockResolvedValue({
    success: true,
    data: { totalAmount: 0, monthlyIncome: 3000, actualIncome: 3000, expectedIncome: 3000 },
  });
});

describe("TxModal - Budget Reassignment & Regression Tests", () => {
  it("reassigns a transaction to a new budget with both budgetId and category in payload", async () => {
    const setOpenSheet = jest.fn();
    const existingTx: TransactionItem = {
      id: "tx-walmart",
      name: "Walmart",
      amount: 50,
      date: "2026-02-10T12:00:00.000Z",
      category: "Groceries",
      budgetId: "b-groceries",
      baseCurrency: "USD",
      type: TransactionType.EXPENSE,
    };

    mockedTxUpdate.mockResolvedValue({
      success: true,
      message: "Transaction updated",
      data: {
        ...existingTx,
        category: "Shopping",
        budgetId: "b-shopping",
      },
    });

    const store = makeStore();
    store.dispatch(setMonthYear({ month: 1, year: 2026 }));

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>
          <AlertProvider>
            <TransactionModal
              openSheet={true}
              setOpenSheet={setOpenSheet}
              editingTransaction={existingTx}
            />
          </AlertProvider>
        </Provider>,
      );
    });

    // Wait for budgets to load
    await until(() => renderedText("Shopping"));

    // Select the "Shopping" budget pill
    const shoppingPill = lastTouchableContaining("Shopping");
    expect(shoppingPill).toBeDefined();
    renderer.act(() => {
      shoppingPill!.onPress();
    });

    // Press "Update Transaction"
    const updateBtn = lastTouchableContaining("Update Transaction");
    expect(updateBtn).toBeDefined();

    await renderer.act(async () => {
      await updateBtn!.onPress();
      await flush();
    });

    // Verify backend update payload includes both budgetId and category
    expect(mockedTxUpdate).toHaveBeenCalledTimes(1);
    expect(mockedTxUpdate).toHaveBeenCalledWith(
      "tx-walmart",
      expect.objectContaining({
        budgetId: "b-shopping",
        category: "Shopping",
      }),
    );

    // Verify modal was closed on success
    expect(setOpenSheet).toHaveBeenCalledWith(false);
  });

  it("handles legacy DTO format where budgetId is on nested budget object", async () => {
    const setOpenSheet = jest.fn();
    const legacyTx: TransactionItem = {
      id: "tx-legacy",
      name: "Supermarket",
      amount: 42,
      date: "2026-02-10T12:00:00.000Z",
      category: "Groceries",
      budget: { id: "b-groceries", category: "Groceries" },
      budgetId: undefined as any,
      baseCurrency: "USD",
      type: TransactionType.EXPENSE,
    };

    mockedTxUpdate.mockResolvedValue({
      success: true,
      message: "Transaction updated",
      data: {
        ...legacyTx,
        category: "Shopping",
        budgetId: "b-shopping",
      },
    });

    const store = makeStore();
    store.dispatch(setMonthYear({ month: 1, year: 2026 }));

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>
          <AlertProvider>
            <TransactionModal
              openSheet={true}
              setOpenSheet={setOpenSheet}
              editingTransaction={legacyTx}
            />
          </AlertProvider>
        </Provider>,
      );
    });

    await until(() => renderedText("Shopping"));

    // Switch to Shopping budget
    const shoppingPill = lastTouchableContaining("Shopping");
    expect(shoppingPill).toBeDefined();
    renderer.act(() => {
      shoppingPill!.onPress();
    });

    // Press "Update Transaction"
    const updateBtn = lastTouchableContaining("Update Transaction");
    await renderer.act(async () => {
      await updateBtn!.onPress();
      await flush();
    });

    expect(mockedTxUpdate).toHaveBeenCalledWith(
      "tx-legacy",
      expect.objectContaining({
        budgetId: "b-shopping",
        category: "Shopping",
      }),
    );
    expect(setOpenSheet).toHaveBeenCalledWith(false);
  });

  it("surfaces error alert, keeps modal open, and preserves inputs when update fails", async () => {
    const setOpenSheet = jest.fn();
    const existingTx: TransactionItem = {
      id: "tx-fail",
      name: "Walmart",
      amount: 50,
      date: "2026-02-10T12:00:00.000Z",
      category: "Groceries",
      budgetId: "b-groceries",
      baseCurrency: "USD",
      type: TransactionType.EXPENSE,
    };

    // Simulate backend mutation failure with specific error message
    mockedTxUpdate.mockRejectedValue(new Error("Database write failed"));

    const store = makeStore();
    store.dispatch(setMonthYear({ month: 1, year: 2026 }));

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>
          <AlertProvider>
            <TransactionModal
              openSheet={true}
              setOpenSheet={setOpenSheet}
              editingTransaction={existingTx}
            />
          </AlertProvider>
        </Provider>,
      );
    });

    await until(() => renderedText("Shopping"));

    // User modifies name and changes budget to Shopping
    renderer.act(() => {
      nameInput()!.onChangeText("Walmart Supercenter");
    });
    const shoppingPill = lastTouchableContaining("Shopping");
    renderer.act(() => {
      shoppingPill!.onPress();
    });

    // User submits update
    const updateBtn = lastTouchableContaining("Update Transaction");
    await renderer.act(async () => {
      await updateBtn!.onPress();
      await flush();
    });

    // 1. Alert is surfaced to user with error message
    expect(renderedText("Error")).toBe(true);
    expect(renderedText("Database write failed")).toBe(true);

    // 2. Modal is NOT dismissed
    expect(setOpenSheet).not.toHaveBeenCalledWith(false);

    // 3. Form fields are preserved
    expect(nameInput()?.value).toBe("Walmart Supercenter");
  });

  it("surfaces default user-friendly error alert when backend returns failure without error message", async () => {
    const setOpenSheet = jest.fn();
    const existingTx: TransactionItem = {
      id: "tx-fail-generic",
      name: "Walmart",
      amount: 50,
      date: "2026-02-10T12:00:00.000Z",
      category: "Groceries",
      budgetId: "b-groceries",
      baseCurrency: "USD",
      type: TransactionType.EXPENSE,
    };

    // Simulate backend response with success: false and no message
    mockedTxUpdate.mockResolvedValue({
      success: false,
    });

    const store = makeStore();
    store.dispatch(setMonthYear({ month: 1, year: 2026 }));

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>
          <AlertProvider>
            <TransactionModal
              openSheet={true}
              setOpenSheet={setOpenSheet}
              editingTransaction={existingTx}
            />
          </AlertProvider>
        </Provider>,
      );
    });

    await until(() => renderedText("Shopping"));

    // User modifies amount so changes are detected
    renderer.act(() => {
      amountInput()!.onChangeText("99.00");
    });

    // User submits update
    const updateBtn = lastTouchableContaining("Update Transaction");
    await renderer.act(async () => {
      await updateBtn!.onPress();
      await flush();
    });

    // Fallback error message is displayed
    expect(renderedText("Error")).toBe(true);
    expect(renderedText("Couldn't update transaction. Please try again.")).toBe(true);
    expect(setOpenSheet).not.toHaveBeenCalledWith(false);
    expect(amountInput()?.value).toBe("99.00");
  });

  it("edits name, amount, and date without altering budget when budget is unchanged", async () => {
    const setOpenSheet = jest.fn();
    const existingTx: TransactionItem = {
      id: "tx-fields",
      name: "Old Name",
      amount: 25,
      date: "2026-02-10T12:00:00.000Z",
      category: "Groceries",
      budgetId: "b-groceries",
      baseCurrency: "USD",
      type: TransactionType.EXPENSE,
    };

    mockedTxUpdate.mockResolvedValue({
      success: true,
      message: "Transaction updated",
      data: {
        ...existingTx,
        name: "New Store Name",
        amount: 35.5,
      },
    });

    const store = makeStore();
    store.dispatch(setMonthYear({ month: 1, year: 2026 }));

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>
          <AlertProvider>
            <TransactionModal
              openSheet={true}
              setOpenSheet={setOpenSheet}
              editingTransaction={existingTx}
            />
          </AlertProvider>
        </Provider>,
      );
    });

    await until(() => renderedText("Groceries"));

    // Modify name and amount
    renderer.act(() => {
      nameInput()!.onChangeText("New Store Name");
      amountInput()!.onChangeText("35.50");
    });

    // Advance date via "Next day" button
    const nextDay = nextDayButton();
    expect(nextDay).toBeDefined();
    renderer.act(() => {
      nextDay!.onPress();
    });

    // Submit update
    const updateBtn = lastTouchableContaining("Update Transaction");
    await renderer.act(async () => {
      await updateBtn!.onPress();
      await flush();
    });

    expect(mockedTxUpdate).toHaveBeenCalledTimes(1);
    const [calledId, calledUpdates] = mockedTxUpdate.mock.calls[0];
    expect(calledId).toBe("tx-fields");
    expect(calledUpdates.name).toBe("New Store Name");
    expect(calledUpdates.amount).toBe(35.5);
    expect(calledUpdates.date).toBeDefined();
    // Budget was NOT changed, so budgetId and category should NOT be in updates
    expect(calledUpdates.budgetId).toBeUndefined();
    expect(calledUpdates.category).toBeUndefined();

    // Modal closed
    expect(setOpenSheet).toHaveBeenCalledWith(false);
  });
});
