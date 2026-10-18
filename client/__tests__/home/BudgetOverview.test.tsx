import React from "react";
import renderer, { act } from "react-test-renderer";
import BudgetOverview from "@/components/home/BudgetOverview";
import type { DisplayBudget } from "@/types/budget/types";

jest.mock("@/hooks/useRedux", () => ({
  useTheme: () => ({ THEME: new Proxy({}, { get: () => "#123456" }) }),
}));

test("shows every budget with persisted spending, zero limits, and overspending", () => {
  const budgets = ["Food", "Rent", "Travel", "Shopping", "Utilities"].map(
    (category, index) => ({
      id: String(index),
      category,
      displayLimit: index === 0 ? 0 : 100,
      displaySpent: 150,
    }),
  ) as DisplayBudget[];
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <BudgetOverview
        budgets={budgets}
        currencyCode="USD"
        loading={false}
        error={false}
        onRetry={jest.fn()}
      />,
    );
  });
  const text = tree.root
    .findAllByType("Text" as any)
    .map((node) => String(node.props.children))
    .join(" ");
  for (const budget of budgets) expect(text).toContain(budget.category);
  expect(text).toContain("over budget");
  expect(text).toContain("150.00");
  expect(text).toContain("100.00");
  act(() => {
    tree.unmount();
  });
});
