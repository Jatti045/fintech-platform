import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { Text, TextInput, TouchableOpacity } from "react-native";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import userReducer from "@/store/slices/userSlice";
import api from "@/store/api/apiSlice";
import budgetApi from "@/api/budget";
import transactionApi from "@/api/transaction";
import { AlertProvider } from "@/utils/themedAlert";
import BudgetModal from "@/components/budget/BudgetModal";
import BudgetHalo from "@/components/budget/BudgetHalo";
import BudgetReservoirRow from "@/components/budget/BudgetReservoirRow";
import MonthSetupModal from "@/components/budget/MonthSetupModal";
import BudgetHeader from "@/components/budget/BudgetHeader";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import {
  budgetReport,
  budgetSuggestions,
} from "../../test-fixtures/budgetsDesign";

jest.mock("@/api/budget", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    fetchSuggestions: jest.fn(),
    applySuggestions: jest.fn(),
  },
}));
jest.mock("@/api/transaction", () => ({
  __esModule: true,
  default: { fetchAll: jest.fn() },
}));
jest.mock("@/components/global/SwipeableRow", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
const until = async (check: () => boolean) => {
  for (let i = 0; i < 80; i++) {
    let ok = false;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2));
      ok = check();
    });
    if (ok) return;
  }
  throw new Error("Timed out waiting for budget UI");
};
function mount(element: React.ReactElement, theme = "Light") {
  const store = configureStore({
    reducer: {
      theme: themeReducer,
      calendar: calendarReducer,
      user: userReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (g) => g().concat(api.middleware),
  });
  store.dispatch(setTheme(theme));
  store.dispatch(setMonthYear({ month: 1, year: 2026 }));
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>{element}</AlertProvider>
      </Provider>,
    );
  });
  return { tree, store };
}
const text = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((n) =>
      Array.isArray(n.props.children)
        ? n.props.children.join("")
        : String(n.props.children),
    )
    .join(" | ");
const button = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === label)!;
const input = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find((n) => n.props.accessibilityLabel === label)!;
beforeEach(() => {
  jest.clearAllMocks();
  (budgetApi.fetchAll as jest.Mock).mockResolvedValue({
    success: true,
    data: [],
  });
  (transactionApi.fetchAll as jest.Mock).mockResolvedValue({
    success: true,
    data: { transaction: [] },
  });
  (budgetApi.fetchSuggestions as jest.Mock).mockResolvedValue({
    success: true,
    data: budgetSuggestions,
  });
});
it.each(["Light", "Dark"])(
  "shows server remaining and existing over-budget thresholds in %s",
  (theme) => {
    const b = budgetReport.budgets[1];
    const budget = { ...b, date: new Date(b.date) };
    const { tree } = mount(
      <BudgetReservoirRow
        budget={budget}
        remaining={-17.34}
        utilizationPercentage={110}
        expanded={false}
        onToggle={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
      theme,
    );
    expect(text(tree)).toContain(formatCurrency(-17.34, "USD"));
    expect(text(tree)).toContain("Over budget");
    const bar = tree.root
      .findAllByType("View" as any)
      .find((n) => n.props.accessibilityRole === "progressbar")!;
    expect(bar.props.accessibilityValue).toMatchObject({
      now: 100,
      text: "110% used, Over budget",
    });
    const palette =
      theme === "Light" ? THEME_PALETTES.LIGHT : THEME_PALETTES.DARK;
    expect(
      bar
        .findAllByType("View" as any)
        .some((n) => n.props.style?.backgroundColor === palette.danger),
    ).toBe(true);
    act(() => {
      tree.unmount();
    });
  },
);
it.each([
  [79, "On track"],
  [80, "Near limit"],
  [100, "Near limit"],
  [101, "Over budget"],
] as const)("keeps the existing threshold at %s percent", (spent, status) => {
  const raw = budgetReport.budgets[0];
  const { tree } = mount(
    <BudgetReservoirRow
      budget={{ ...raw, date: new Date(raw.date), limit: 100, spent }}
      expanded={false}
      onToggle={jest.fn()}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
    />,
  );
  expect(text(tree)).toContain(status);
  act(() => {
    tree.unmount();
  });
});
it("keeps full-month server spending in the summary", () => {
  const { tree } = mount(
    <BudgetHalo
      budgets={budgetReport.budgets.map((b) => ({
        ...b,
        displayLimit: b.limit,
        displaySpent: b.spent,
      }))}
      monthlySpent={1234.56}
      monthLabel="February"
      year={2026}
      currencyCode="CAD"
    />,
  );
  expect(text(tree)).toContain(formatCurrency(1234.56, "CAD"));
  expect(text(tree)).toContain("Over budget by");
  expect(text(tree)).toContain("Total budgeted");
  act(() => {
    tree.unmount();
  });
});
it("navigates months and exposes setup without a hidden search field", () => {
  const setup = jest.fn();
  const { tree, store } = mount(
    <BudgetHeader
      monthLabel="February"
      year={2026}
      showSearch
      searchQuery=""
      onSearchChange={jest.fn()}
      onSetup={setup}
    />,
  );
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  act(() => {
    button(tree, "Previous month").props.onPress();
    button(tree, "Smart Month Setup").props.onPress();
  });
  expect(store.getState().calendar.month).toBe(0);
  expect(setup).toHaveBeenCalledTimes(1);
  act(() => {
    tree.unmount();
  });
});
it("validates then creates a budget with the existing month payload", async () => {
  (budgetApi.create as jest.Mock).mockResolvedValue({
    success: true,
    data: {},
  });
  const close = jest.fn();
  const { tree } = mount(<BudgetModal openSheet setOpenSheet={close} />);
  act(() => {
    button(tree, "Save Budget").props.onPress();
  });
  await until(() => text(tree).includes("Missing Information"));
  expect(budgetApi.create).not.toHaveBeenCalled();
  act(() => {
    button(tree, "OK").props.onPress();
    input(tree, "Budget category").props.onChangeText("Groceries");
    input(tree, "Budget limit amount").props.onChangeText("500");
  });
  act(() => {
    button(tree, "Save Budget").props.onPress();
  });
  await until(() => close.mock.calls.some((c) => c[0] === false));
  expect(budgetApi.create).toHaveBeenCalledWith({
    category: "Groceries",
    limit: 500,
    month: 1,
    year: 2026,
  });
  act(() => {
    tree.unmount();
  });
});
it("shows saving state and blocks duplicate submission while creating", async () => {
  let resolve!: (value: unknown) => void;
  (budgetApi.create as jest.Mock).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const close = jest.fn();
  const { tree } = mount(<BudgetModal openSheet setOpenSheet={close} />);
  act(() => {
    input(tree, "Budget category").props.onChangeText("Groceries");
    input(tree, "Budget limit amount").props.onChangeText("500");
  });
  act(() => {
    button(tree, "Save Budget").props.onPress();
  });
  await until(() => button(tree, "Save Budget").props.accessibilityState.busy);
  expect(button(tree, "Cancel budget").props.disabled).toBe(true);
  expect(input(tree, "Budget category").props.editable).toBe(false);
  act(() => {
    button(tree, "Save Budget").props.onPress();
  });
  expect(budgetApi.create).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ success: true, data: {} });
    await Promise.resolve();
  });
  await until(() => close.mock.calls.some((c) => c[0] === false));
  act(() => {
    tree.unmount();
  });
});
it("preserves input on a uniqueness error and updates only changed fields", async () => {
  const b = {
    ...budgetReport.budgets[0],
    date: new Date(budgetReport.budgets[0].date),
  };
  const close = jest.fn();
  (budgetApi.update as jest.Mock).mockRejectedValue(
    new Error("Category already exists"),
  );
  const { tree } = mount(
    <BudgetModal openSheet editingBudget={b} setOpenSheet={close} />,
  );
  act(() => {
    input(tree, "Budget limit amount").props.onChangeText("650");
  });
  act(() => {
    button(tree, "Update Budget").props.onPress();
  });
  await until(() => text(tree).includes("Category already exists"));
  expect(input(tree, "Budget limit amount").props.value).toBe("650");
  expect(close).not.toHaveBeenCalled();
  expect(budgetApi.update).toHaveBeenCalledWith(b.id, { limit: 650 });
  act(() => {
    button(tree, "OK").props.onPress();
  });
  (budgetApi.update as jest.Mock).mockResolvedValue({
    success: true,
    data: {},
  });
  act(() => {
    button(tree, "Update Budget").props.onPress();
  });
  await until(() => close.mock.calls.some((c) => c[0] === false));
  act(() => {
    tree.unmount();
  });
});
it("requires delete confirmation before calling the existing mutation", async () => {
  (budgetApi.delete as jest.Mock).mockResolvedValue({
    success: true,
    data: {},
  });
  let operations!: ReturnType<typeof useBudgetOperations>;
  function Harness() {
    operations = useBudgetOperations();
    return null;
  }
  const { tree } = mount(<Harness />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
  act(() => {
    operations.handleDeleteBudget("food");
  });
  expect(text(tree)).toContain("Delete Budget");
  expect(budgetApi.delete).not.toHaveBeenCalled();
  await act(async () => {
    await button(tree, "Delete").props.onPress();
  });
  expect(budgetApi.delete).toHaveBeenCalledWith("food");
  act(() => {
    tree.unmount();
  });
});
it("reviews inherited limits and historical suggestions and applies only the selected edit", async () => {
  const close = jest.fn();
  (budgetApi.applySuggestions as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      created: 1,
      updated: 0,
      skipped: 0,
      budgets: [],
      skippedItems: [],
      month: 1,
      year: 2026,
    },
  });
  const { tree } = mount(
    <MonthSetupModal
      open
      onOpenChange={close}
      month={1}
      year={2026}
      currencyCode="CAD"
      monthLabel="February"
    />,
  );
  await until(() => text(tree).includes("From your last month's budget"));
  expect(text(tree)).toContain("Based on 3 months of recent spending");
  expect(
    button(tree, "Select Groceries").props.accessibilityState.checked,
  ).toBe(true);
  act(() => {
    button(tree, "Deselect all").props.onPress();
  });
  expect(button(tree, "Apply 0 budgets").props.disabled).toBe(true);
  act(() => {
    button(tree, "Select Entertainment").props.onPress();
    input(tree, "Entertainment suggested limit").props.onChangeText("175");
  });
  act(() => {
    button(tree, "Apply 1 budget").props.onPress();
  });
  await until(() => close.mock.calls.some((c) => c[0] === false));
  expect(budgetApi.applySuggestions).toHaveBeenCalledWith({
    month: 1,
    year: 2026,
    items: [{ category: "Entertainment", limit: 175 }],
  });
  act(() => {
    tree.unmount();
  });
});
