import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BackHandler, TextInput, TouchableOpacity } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AlertProvider } from "@/utils/themedAlert";
import TransactionModal from "@/components/transaction/TxModal";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import api from "@/store/api/apiSlice";
import transactionApi from "@/api/transaction";
import budgetApi from "@/api/budget";
import financialSummaryApi from "@/api/financialSummary";

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
  default: { fetchAll: jest.fn() },
}));
jest.mock("@/api/financialSummary", () => ({
  __esModule: true,
  default: { fetchSummary: jest.fn() },
}));
const { sheetInstances, sheetLifecycle } = require("@gorhom/bottom-sheet");
const button = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === label)!;
const input = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find((n) => n.props.accessibilityLabel === label)!;
const title = "Add New Transaction";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    let ready = false;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2));
      ready = check();
    });
    if (ready) return;
  }
  throw new Error("Timed out waiting for transaction state");
}
async function mount(editing?: any) {
  const store = configureStore({
    reducer: {
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (g) => g().concat(api.middleware),
  });
  store.dispatch(setMonthYear({ month: 1, year: 2026 }));
  const closed = jest.fn();
  function Harness() {
    const [visible, setVisible] = React.useState(false);
    return (
      <>
        <TouchableOpacity
          accessibilityLabel="Open transaction"
          onPress={() => setVisible(true)}
        />
        <TransactionModal
          openSheet={visible}
          setOpenSheet={setVisible}
          editingTransaction={editing}
          onClose={closed}
        />
      </>
    );
  }
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Harness />
        </AlertProvider>
      </Provider>,
    );
    await flush();
  });
  return { tree, closed, store };
}
beforeEach(() => {
  jest.clearAllMocks();
  sheetLifecycle.deferDismiss = false;
  sheetLifecycle.deferPresent = false;
  (transactionApi.fetchAll as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      transaction: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    },
  });
  (budgetApi.fetchAll as jest.Mock).mockResolvedValue({
    success: true,
    data: [],
  });
  (financialSummaryApi.fetchSummary as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      totalAmount: 0,
      monthlyIncome: 0,
      actualIncome: 0,
      expectedIncome: 0,
    },
  });
});
it.each([
  "pristine swipe",
  "pristine back",
  "income swipe",
  "expense swipe",
  "text swipe",
  "back",
  "backdrop",
  "cancel",
])(
  "New Transaction resets and reopens for five cycles after %s",
  async (method) => {
    const { tree, closed } = await mount();
    for (let i = 0; i < 5; i++) {
      act(() => button(tree, "Open transaction").props.onPress());
      expect(input(tree, "Transaction name").props.value).toBe("");
      expect(input(tree, "Transaction amount").props.value).toBe("");
      expect(
        button(tree, "Expense transaction").props.accessibilityState.selected,
      ).toBe(true);
      if (!method.startsWith("pristine"))
        act(() => button(tree, "Income transaction").props.onPress());
      if (method === "expense swipe")
        act(() => button(tree, "Expense transaction").props.onPress());
      if (["text swipe", "back", "backdrop", "cancel"].includes(method))
        act(() => {
          input(tree, "Transaction name").props.onChangeText("Draft");
          input(tree, "Transaction amount").props.onChangeText("42");
        });
      expect(
        tree.root
          .findAllByType(BottomSheetModal)
          .find((n) => n.props.accessibilityLabel === title)!.props
          .enablePanDownToClose,
      ).toBe(true);
      await act(async () => {
        if (method === "back" || method === "pristine back")
          expect(
            (BackHandler.addEventListener as jest.Mock).mock.calls.at(-1)![1](),
          ).toBe(true);
        else if (method === "backdrop")
          button(tree, `Dismiss ${title} backdrop`).props.onPress();
        else if (method === "cancel")
          button(tree, "Cancel transaction").props.onPress();
        else sheetInstances.get(title).swipe();
        await flush();
      });
      expect(button(tree, `Dismiss ${title}`)).toBeUndefined();
      expect(button(tree, "Discard changes")).toBeUndefined();
      expect(closed).toHaveBeenCalledTimes(i + 1);
    }
    act(() => tree.unmount());
  },
);
it("Edit Transaction still protects modified fields", async () => {
  const { tree } = await mount({
    id: "edit-test",
    name: "Existing",
    amount: 10,
    date: "2026-02-05T12:00:00Z",
    type: "EXPENSE",
    baseCurrency: "USD",
    category: "Other",
  });
  act(() => button(tree, "Open transaction").props.onPress());
  act(() => input(tree, "Transaction name").props.onChangeText("Changed"));
  expect(
    tree.root
      .findAllByType(BottomSheetModal)
      .find((n) => n.props.accessibilityLabel === "Edit Transaction")!.props
      .enablePanDownToClose,
  ).toBe(false);
  act(() =>
    (BackHandler.addEventListener as jest.Mock).mock.calls.at(-1)![1](),
  );
  expect(button(tree, "Keep editing")).toBeTruthy();
  act(() => button(tree, "Keep editing").props.onPress());
  expect(input(tree, "Transaction name").props.value).toBe("Changed");
  act(() => tree.unmount());
});
it("nested currency selection and dismissal leave the new draft usable", async () => {
  const { tree } = await mount();
  act(() => button(tree, "Open transaction").props.onPress());
  act(() => input(tree, "Transaction name").props.onChangeText("Draft"));
  for (let i = 0; i < 3; i++) {
    act(() => button(tree, "Transaction currency").props.onPress());
    expect(button(tree, "Currency USD")).toBeTruthy();
    act(() =>
      i === 0
        ? button(tree, "Currency USD").props.onPress()
        : sheetInstances.get("Select Currency").swipe(),
    );
    expect(button(tree, "Dismiss Select Currency")).toBeUndefined();
    expect(input(tree, "Transaction name").props.value).toBe("Draft");
  }
  act(() => sheetInstances.get(title).swipe());
  act(() => button(tree, "Open transaction").props.onPress());
  expect(input(tree, "Transaction name").props.value).toBe("");
  act(() => tree.unmount());
});
it("a pending save blocks Back, backdrop and Cancel, then allows dismissal after failure", async () => {
  let finish!: (value: any) => void;
  (transactionApi.create as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { tree, closed, store } = await mount();
  act(() => button(tree, "Open transaction").props.onPress());
  act(() => {
    input(tree, "Transaction name").props.onChangeText("Income");
    input(tree, "Transaction amount").props.onChangeText("10");
  });
  // The existing create flow closes before the request starts. Seed a pending
  // mutation while open to verify the UI guard independently of that close.
  let operation: any;
  await act(async () => {
    operation = store.dispatch(
      api.endpoints.createTransaction.initiate({
        name: "Pending",
        amount: 10,
      } as any),
    );
    await flush();
  });
  expect(transactionApi.create).toHaveBeenCalledTimes(1);
  await until(
    () =>
      tree.root
        .findAllByType(BottomSheetModal)
        .find((n) => n.props.accessibilityLabel === title)!.props
        .enablePanDownToClose === false,
  );
  expect(
    tree.root
      .findAllByType(BottomSheetModal)
      .find((n) => n.props.accessibilityLabel === title)!.props
      .enablePanDownToClose,
  ).toBe(false);
  expect(button(tree, `Dismiss ${title} backdrop`)).toBeTruthy();
  act(() =>
    (BackHandler.addEventListener as jest.Mock).mock.calls.at(-1)![1](),
  );
  expect(button(tree, `Dismiss ${title} backdrop`)).toBeTruthy();
  act(() => button(tree, `Dismiss ${title} backdrop`).props.onPress());
  act(() => button(tree, "Cancel transaction").props.onPress());
  expect(closed).not.toHaveBeenCalled();
  await act(async () => {
    finish({ success: false, message: "Test failure" });
    await operation;
    await flush();
  });
  await until(
    () =>
      tree.root
        .findAllByType(BottomSheetModal)
        .find((n) => n.props.accessibilityLabel === title)!.props
        .enablePanDownToClose === true,
  );
  expect(input(tree, "Transaction name").props.value).toBe("Income");
  act(() => button(tree, "Cancel transaction").props.onPress());
  expect(closed).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it("preserves the existing close-on-submit flow and reopens with fresh defaults after success", async () => {
  (transactionApi.create as jest.Mock).mockResolvedValue({
    success: true,
    data: { id: "created-test" },
  });
  const { tree, closed } = await mount();
  act(() => button(tree, "Open transaction").props.onPress());
  act(() => button(tree, "Income transaction").props.onPress());
  act(() => {
    input(tree, "Transaction name").props.onChangeText("Income");
    input(tree, "Transaction amount").props.onChangeText("10");
  });
  await act(async () => {
    button(tree, "Save Transaction").props.onPress();
    await flush();
  });
  expect(transactionApi.create).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledTimes(1);
  act(() => button(tree, "Open transaction").props.onPress());
  expect(input(tree, "Transaction name").props.value).toBe("");
  expect(
    button(tree, "Expense transaction").props.accessibilityState.selected,
  ).toBe(true);
  act(() => tree.unmount());
});
