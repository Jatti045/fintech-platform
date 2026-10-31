import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { Text, TouchableOpacity } from "react-native";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import { homeReport } from "../../test-fixtures/homeReport";
import BudgetOverview from "@/components/home/BudgetOverview";
import MonthlyOverview from "@/components/home/MonthlyOverview";
import RecentTransactions from "@/components/home/RecentTransactions";
import UpcomingBillsCard from "@/components/home/UpcomingBillsCard";
import { formatCurrency } from "@/utils/helper";
import { TransactionType } from "@/types/transaction/types";
import type { IRecurringPayment } from "@/types/recurring/types";

jest.mock("@/hooks/useRedux", () => ({
  ...jest.requireActual("@/hooks/useRedux"),
  useBudgets: () => [],
}));
function mount(element: React.ReactElement, theme = "Light") {
  const store = configureStore({ reducer: { theme: themeReducer } });
  store.dispatch(setTheme(theme));
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Provider store={store}>{element}</Provider>);
  });
  return tree;
}
function texts(tree: renderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .map((n) =>
      Array.isArray(n.props.children)
        ? n.props.children.join("")
        : String(n.props.children),
    )
    .join(" | ");
}
function button(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === label)!;
}
it.each(["Light", "Dark"])(
  "uses authoritative amounts and themed budget progress in %s",
  (theme) => {
    const open = jest.fn();
    const tree = mount(
      <BudgetOverview report={homeReport} onOpenBudgets={open} />,
      theme,
    );
    expect(texts(tree)).toContain(formatCurrency(-20, "CAD"));
    expect(texts(tree)).toContain("Over budget");
    const over = tree.root
      .findAllByType("View" as any)
      .find(
        (n) =>
          n.props.accessibilityRole === "progressbar" &&
          n.props.accessibilityValue.text === "110% used",
      )!;
    expect(over.props.accessibilityValue.now).toBe(100);
    expect(
      over
        .findAllByType("View" as any)
        .some(
          (n) =>
            n.props.style?.backgroundColor ===
            THEME_PALETTES[theme === "Light" ? "LIGHT" : "DARK"].danger,
        ),
    ).toBe(true);
    act(() => {
      button(tree, "View budgets").props.onPress();
    });
    expect(open).toHaveBeenCalled();
    act(() => {
      tree.unmount();
    });
  },
);
it("shows report net remaining verbatim rather than recomputing an account balance", () => {
  const tree = mount(
    <MonthlyOverview
      monthlyIncome={4200}
      totalSpent={1842.75}
      monthLabel="February 2026"
      currencyCode="CAD"
      isCurrentMonth={false}
      report={{
        ...homeReport,
        summary: { ...homeReport.summary, netRemaining: 2345.67 },
      }}
    />,
  );
  expect(texts(tree)).toContain(formatCurrency(2345.67, "CAD"));
  expect(texts(tree)).not.toContain("balance");
  act(() => {
    tree.unmount();
  });
});
it("distinguishes refunds, expenses, and transfers in recent rows and keeps UTC reporting dates", () => {
  const open = jest.fn();
  const base = {
    month: 1,
    year: 2026,
    category: "Travel",
    amount: 12,
    date: "2026-02-01T00:00:00Z",
    type: TransactionType.EXPENSE,
    baseCurrency: "EUR",
  };
  const tree = mount(
    <RecentTransactions
      currencyCode="CAD"
      onSeeAll={open}
      transactions={[
        { ...base, id: "refund", name: "Refund", amount: -12 },
        { ...base, id: "expense", name: "Train" },
        { ...base, id: "transfer", name: "Between accounts", isTransfer: true },
      ]}
    />,
  );
  const output = texts(tree);
  expect(output).toContain(`+${formatCurrency(12, "EUR")}`);
  expect(output).toContain(`−${formatCurrency(12, "EUR")}`);
  expect(output).toContain("Transfer");
  expect(output).toContain("Feb 1");
  act(() => {
    button(tree, "See all transactions").props.onPress();
  });
  expect(open).toHaveBeenCalled();
  act(() => {
    tree.unmount();
  });
});
it("separates loading and failure from empty transactions and wires retry", () => {
  const retry = jest.fn();
  const tree = mount(
    <RecentTransactions
      transactions={[]}
      currencyCode="CAD"
      error
      onRetry={retry}
    />,
  );
  expect(texts(tree)).toContain("could not be refreshed");
  expect(texts(tree)).not.toContain("No transactions");
  expect(texts(tree)).not.toContain(formatCurrency(0, "CAD"));
  act(() => {
    button(tree, "Retry: Transactions could not be refreshed.").props.onPress();
  });
  expect(retry).toHaveBeenCalled();
  act(() => {
    tree.unmount();
  });
  const pending = mount(
    <RecentTransactions transactions={[]} currencyCode="CAD" loading />,
  );
  expect(texts(pending)).toContain("Loading transactions");
  expect(texts(pending)).not.toContain("No transactions");
  act(() => {
    pending.unmount();
  });
});
it("expands bill evidence, formats its own currency, and dismisses the selected series", () => {
  const dismiss = jest.fn();
  const bill: IRecurringPayment = {
    seriesKey: "test-series",
    name: "Membership",
    expectedAmount: 18,
    currency: "EUR",
    cadence: "MONTHLY",
    intervalDays: 30,
    usualDayOfMonth: 2,
    nextExpectedDate: "2026-03-02T00:00:00Z",
    lastOccurredDate: "2026-02-02T00:00:00Z",
    occurrences: 4,
    confidence: "MEDIUM",
    amountChange: { previousAmount: 16, currentAmount: 18 },
    matchedTransactions: [],
  };
  const tree = mount(
    <UpcomingBillsCard bills={[bill]} currencyCode="CAD" onDismiss={dismiss} />,
  );
  expect(texts(tree)).toContain(`~${formatCurrency(18, "EUR")}`);
  expect(texts(tree)).toContain(`was ${formatCurrency(16, "EUR")}`);
  act(() => {
    button(
      tree,
      `Bill Membership, ~${formatCurrency(18, "EUR")}`,
    ).props.onPress();
  });
  expect(texts(tree)).toContain("Based on 4 occurrences");
  act(() => {
    button(tree, "Dismiss Membership").props.onPress();
  });
  expect(dismiss).toHaveBeenCalledWith("test-series");
  act(() => {
    tree.unmount();
  });
});
