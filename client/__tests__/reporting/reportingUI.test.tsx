import React from "react";
import renderer, { act } from "react-test-renderer";
import MonthlyOverview from "@/components/home/MonthlyOverview";
import FinancialMetrics from "@/components/home/FinancialMetrics";
import BudgetContent from "@/components/budget/BudgetContent";
import BudgetIncomeSummary from "@/components/budget/BudgetIncomeSummary";
import MonthlyIncome from "@/components/profile/MonthlyIncome";
import ReportStatus from "@/components/reporting/ReportStatus";
import { formatCurrency } from "@/utils/helper";
import type { IFinancialReport } from "@/types/financialSummary/types";

const report: IFinancialReport = {
  year: 2026, month: 1, currency: "USD", generatedAt: "2026-02-20T12:00:00Z", incomeBasis: "EXPECTED", expectedIncomeConfigured: true,
  transactionCount: 26, grossExpenses: 650, expenseCredits: 50,
  summary: { totalAmount: 600, monthlyIncome: 0, expectedIncome: 0, actualIncome: 0, netSpent: 600, netRemaining: -600, spentPercentageOfIncome: 0 },
  daily: [{ day: 20, grossExpenses: 650, expenseCredits: 50, netSpent: 600 }], categories: [],
  budgets: [{ id: "food", category: "Food", limit: 100, spent: 200, remaining: -100, utilizationPercentage: 200, autoCreated: false, userId: "u", date: "2026-02-01T00:00:00Z", createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z" },
    { id: "rent", category: "Rent", limit: 200, spent: 400, remaining: -200, utilizationPercentage: 200, autoCreated: false, userId: "u", date: "2026-02-01T00:00:00Z", createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z" }],
  previousPeriod: { year: 2026, month: 0, actualIncome: 0, netSpent: 0, actualIncomeChange: 0, netSpentChange: 600, incomeChangePercentage: null, spendingChangePercentage: null },
};
let reporting: any;
jest.mock("@/hooks/reporting/useFinancialReport", () => ({ useFinancialReport: () => reporting }));
jest.mock("@/hooks/useRedux", () => ({ useTheme: () => ({ THEME: new Proxy({}, { get: () => "#123456" }) }) }));
function mount(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(element); });
  return tree;
}
function texts(tree: renderer.ReactTestRenderer) { return tree.root.findAllByType("Text" as any).map(n => Array.isArray(n.props.children) ? n.props.children.join("") : String(n.props.children)).join(" | "); }
const props: any = { month: 1, year: 2026, monthLabel: "February", activeCurrency: "USD", searchQuery: "", filteredBudgets: [], budgetedBudgets: [], unbudgetedBudgets: [], transactions: [], hasBudgets: true, isInitialLoading: false, onToggle: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn(), onSetLimit: jest.fn(), onSetup: jest.fn() };
beforeEach(() => { reporting = { report, isFetching: false, stale: false, error: undefined, refetch: jest.fn() }; });
test("budget search only changes matching rows and labeled subtotals, including no matches", () => {
  const tree = mount(<BudgetContent {...props} />);
  expect(tree.root.findByType(BudgetIncomeSummary).props).toMatchObject({ income: 0, totalSpent: 600, totalLimit: 300 });
  act(() => { tree.update(<BudgetContent {...props} searchQuery="Food" />); });
  expect(tree.root.findByType(BudgetIncomeSummary).props).toMatchObject({ income: 0, totalSpent: 600, totalLimit: 300 });
  expect(tree.root.findAll(n => n.props.monthlySpent === 600 && Array.isArray(n.props.budgets))[0].props.budgets).toHaveLength(2);
  expect(texts(tree)).toContain("Matching categories spent");
  act(() => { tree.update(<BudgetContent {...props} searchQuery="No match" />); });
  expect(tree.root.findByType(BudgetIncomeSummary).props.totalSpent).toBe(600);
  expect(texts(tree)).toContain("No budgets match");
  act(() => { tree.unmount(); });
});
test.each(["loading", "error", "unavailable"])("%s reports never fabricate numeric results", state => {
  reporting = { report: undefined, isFetching: state === "loading", error: state === "error" ? {} : undefined, stale: false, refetch: jest.fn() };
  const tree = mount(<BudgetContent {...props} />);
  expect(tree.root.findAllByType(BudgetIncomeSummary)).toHaveLength(0);
  expect(texts(tree)).not.toContain(formatCurrency(0, "USD"));
  act(() => { tree.unmount(); });
});
test("failed refresh keeps real cached figures and explicitly marks them stale", () => {
  reporting.error = {}; reporting.stale = true;
  const tree = mount(<BudgetContent {...props} />);
  expect(texts(tree)).toContain("Cached report"); expect(texts(tree)).toContain("Refresh failed");
  expect(tree.root.findByType(BudgetIncomeSummary).props.income).toBe(0);
  act(() => { tree.unmount(); });
});
test("Home keeps negative remaining income, zero activity bars, and no hard-coded comparisons", () => {
  const tree = mount(<MonthlyOverview monthlyIncome={0} totalSpent={600} monthLabel="February" currencyCode="USD" isCurrentMonth={false} month={1} year={2026} daily={[]} />);
  expect(texts(tree)).toContain("-600"); expect(texts(tree)).toContain("over income");
  const bars = tree.root.findAllByType("View" as any).filter(n => n.props.style?.width === 5 && n.props.style?.marginBottom === undefined);
  expect(bars.every(n => n.props.style.height === 0)).toBe(true);
  act(() => { tree.unmount(); });
  const metrics = mount(<FinancialMetrics monthlyIncome={0} totalSpent={-50} currencyCode="USD" report={report} />);
  expect(texts(metrics)).toContain("-50"); expect(texts(metrics)).not.toContain("+12%");
  expect(texts(metrics)).toContain("No prior spending basis");
  act(() => { metrics.unmount(); });
});
test("empty recorded activity and an unconfigured income baseline are labeled separately", () => {
  const tree = mount(<ReportStatus report={{ ...report, transactionCount: 0, incomeBasis: "UNCONFIGURED", expectedIncomeConfigured: false }} loading={false} error={undefined} stale={false} onRetry={jest.fn()} />);
  expect(texts(tree)).toContain("No income or spending recorded"); expect(texts(tree)).toContain("not been configured");
  act(() => { tree.unmount(); });
});

test("Profile recorded income uses the account currency and never invents zero while unavailable", () => {
  const props = { input: "1000", setInput: jest.fn(), monthLabel: "February", saving: false, onSave: jest.fn(), currencyCode: "EUR" };
  const tree = mount(<MonthlyIncome {...props} actualIncome={null} loading />);
  expect(texts(tree)).toContain("Loading recorded income"); expect(texts(tree)).not.toContain(formatCurrency(0, "EUR"));
  act(() => { tree.update(<MonthlyIncome {...props} actualIncome={null} error />); });
  expect(texts(tree)).toContain("Recorded income unavailable");
  act(() => { tree.update(<MonthlyIncome {...props} actualIncome={0} />); });
  expect(texts(tree)).toContain(formatCurrency(0, "EUR")); expect(texts(tree)).toContain(formatCurrency(1000, "EUR"));
  act(() => { tree.unmount(); });
});
