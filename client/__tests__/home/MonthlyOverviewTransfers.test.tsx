import React from "react";
import renderer, { act } from "react-test-renderer";
import MonthlyOverview from "@/components/home/MonthlyOverview";
import type { ITransaction } from "@/types/transaction/types";

jest.mock("@/hooks/useRedux", () => ({
  useTheme: () => ({ THEME: { textPrimary: "text", success: "success", surfaceHover: "bar", surface: "surface", border: "border" } }),
}));

function bars(transactions: ITransaction[]) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<MonthlyOverview monthlyIncome={1000} totalSpent={30}
    monthLabel="March" currencyCode="USD" isCurrentMonth={false} month={2} year={2025} transactions={transactions} />); });
  const heights = tree.root.findAllByType("View" as any)
    .map((node) => node.props.style)
    .filter((style) => style?.width === 5 && (style.backgroundColor === "bar" || style.backgroundColor === "success"))
    .map((style) => style.height);
  act(() => { tree.unmount(); });
  return heights;
}

test("spending trend is unchanged by transfer legs and normal income", () => {
  const purchases = [
    { date: "2025-03-25T12:00:00Z", amount: 10, type: "EXPENSE" },
    { date: "2025-03-26T12:00:00Z", amount: 20, type: "EXPENSE" },
  ] as ITransaction[];
  const ledger = [...purchases,
    { date: "2025-03-25T12:00:00Z", amount: 500, type: "EXPENSE", isTransfer: true },
    { date: "2025-03-27T12:00:00Z", amount: 500, type: "INCOME", isTransfer: true },
    { date: "2025-03-28T12:00:00Z", amount: 1000, type: "INCOME" },
  ] as ITransaction[];
  expect(bars(purchases)).toHaveLength(8);
  expect(bars(ledger)).toEqual(bars(purchases));
  expect(ledger).toHaveLength(5);
});
