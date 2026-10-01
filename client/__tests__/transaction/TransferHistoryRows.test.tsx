import React from "react";
import renderer, { act } from "react-test-renderer";
import TransactionRow from "@/components/transaction/TxRow";
import type { TransactionItem } from "@/types/transaction/types";

jest.mock("@/hooks/useRedux", () => ({
  useTheme: () => ({ THEME: {} }), useBudgets: () => [],
}));
jest.mock("@/components/global/SwipeableRow", () => ({
  __esModule: true, default: ({ children }: { children: React.ReactNode }) => children,
}));

test("both internal transfer legs remain rendered with their original direction", () => {
  const outgoing = { id: "out", name: "Checking to Savings", category: "Transfer Out", date: "2026-03-15", amount: 500,
    type: "EXPENSE", isTransfer: true, baseCurrency: "USD" } as TransactionItem;
  const incoming = { ...outgoing, id: "in", name: "Savings from Checking", category: "Transfer In", type: "INCOME" } as TransactionItem;
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<>
    <TransactionRow tx={outgoing} onEdit={jest.fn()} onDelete={jest.fn()} />
    <TransactionRow tx={incoming} onEdit={jest.fn()} onDelete={jest.fn()} />
  </>); });
  const text = tree.root.findAllByType("Text" as any).map(node => [node.props.children].flat().join(""));
  expect(text).toContain("Checking to Savings");
  expect(text).toContain("Savings from Checking");
  expect(text.filter(value => value.includes("·  Transfer"))).toHaveLength(2);
  expect(text.some(value => value.includes("−$500"))).toBe(true);
  expect(text.some(value => value.includes("+$500"))).toBe(true);
  act(() => { tree.unmount(); });
});
