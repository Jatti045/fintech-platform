import React from "react";
import renderer, { act } from "react-test-renderer";
import SpendingRhythm from "@/components/home/SpendingRhythm";
import BudgetTrendCard from "@/components/budget/BudgetTrendCard";
import BudgetHalo from "@/components/budget/BudgetHalo";
import { formatCurrency } from "@/utils/helper";

jest.mock("@/hooks/useRedux", () => ({
  useTheme: () => ({ THEME: new Proxy({}, { get: () => "#123456" }) }),
}));

function texts(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(element); });
  const result = tree.root.findAllByType("Text" as any)
    .map(node => String(node.props.children));
  act(() => { tree.unmount(); });
  return result;
}

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2027-01-01T00:30:00Z")); });
afterEach(() => { jest.useRealTimers(); });

test("daily spending highlights the UTC month while Toronto is still in December", () => {
  expect(texts(<SpendingRhythm transactions={[]} month={0} year={2027} currencyCode="USD" />))
    .toContain("Today highlighted");
  expect(texts(<SpendingRhythm transactions={[]} month={11} year={2026} currencyCode="USD" />))
    .not.toContain("Today highlighted");
});

test("budget daily allowance uses day one of the UTC reporting month", () => {
  const output = texts(<BudgetTrendCard category="Food" displayLimit={310} displaySpent={0}
    currencyCode="USD" transactions={[]} month={0} year={2027} />);
  expect(output).toContain(formatCurrency(10, "USD"));
});

test("budget header defaults to the UTC reporting year", () => {
  expect(texts(<BudgetHalo budgets={[]} monthLabel="January" currencyCode="USD" />))
    .toContain("JANUARY 2027");
});
