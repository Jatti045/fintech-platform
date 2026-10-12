import { configureStore } from "@reduxjs/toolkit";
import api from "@/store/api/apiSlice";
import financialAPI from "@/api/financialSummary";
import transactionAPI from "@/api/transaction";
import { fetchPlaidItems } from "@/store/slices/plaidSlice";
import plaidReducer from "@/store/slices/plaidSlice";
import { plaidAPI } from "@/api/plaid";
import budgetAPI from "@/api/budget";

jest.mock("@/api/financialSummary", () => ({ __esModule: true, default: { fetchSummary: jest.fn(), fetchReport: jest.fn() } }));
jest.mock("@/api/transaction", () => ({ __esModule: true, default: { fetchAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }));
jest.mock("@/api/plaid", () => ({ plaidAPI: { fetchItems: jest.fn() } }));
jest.mock("@/api/budget", () => ({ __esModule: true, default: { fetchAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }));
const args = { currentMonth: 1, currentYear: 2026 };
const data = { year: 2026, month: 1, currency: "USD", generatedAt: "2026-02-20T12:00:00Z", summary: { netSpent: 1250 }, daily: [{ day: 20, netSpent: 1250 }] };
const makeStore = () => configureStore({ reducer: { [api.reducerPath]: api.reducer, plaid: plaidReducer }, middleware: g => g().concat(api.middleware) });
beforeEach(() => { jest.clearAllMocks(); (financialAPI.fetchReport as jest.Mock).mockResolvedValue({ success: true, data }); });
async function flush() { await new Promise(r => setTimeout(r, 20)); }
test("complete report survives pagination and search without a new report request", async () => {
  const store = makeStore(); const report = store.dispatch(api.endpoints.getFinancialReport.initiate(args));
  await report.unwrap();
  (transactionAPI.fetchAll as jest.Mock).mockResolvedValue({ data: { transaction: [], pagination: { page: 1, totalPages: 2, totalTransactions: 25, hasNextPage: true, hasPreviousPage: false, limit: 20 } } });
  for (const [page, searchQuery] of [[1, ""], [2, ""], [1, "Coffee"]] as const) {
    const query = store.dispatch(api.endpoints.getTransactions.initiate({ ...args, page, searchQuery }));
    await query.unwrap(); query.unsubscribe();
  }
  expect(api.endpoints.getFinancialReport.select(args)(store.getState()).data).toEqual(data);
  expect(financialAPI.fetchReport).toHaveBeenCalledTimes(1);
  report.unsubscribe(); store.dispatch(api.util.resetApiState());
});
test.each(["createTransaction", "updateTransaction", "deleteTransaction", "createBudget", "updateBudget", "deleteBudget"] as const)("%s refreshes the report", async endpoint => {
  const store = makeStore(); const report = store.dispatch(api.endpoints.getFinancialReport.initiate(args)); await report.unwrap();
  (transactionAPI.create as jest.Mock).mockResolvedValue({ success: true });
  (transactionAPI.update as jest.Mock).mockResolvedValue({ success: true });
  (transactionAPI.delete as jest.Mock).mockResolvedValue({ success: true });
  (budgetAPI.create as jest.Mock).mockResolvedValue({ success: true });
  (budgetAPI.update as jest.Mock).mockResolvedValue({ success: true });
  (budgetAPI.delete as jest.Mock).mockResolvedValue({ success: true });
  const payload: any = { id: "x", month: 1, year: 2026, date: "2026-02-20T12:00:00Z", updates: {}, invalidateMonths: [{ year: 2026, month: 1 }] };
  await store.dispatch((api.endpoints[endpoint] as any).initiate(payload)); await flush();
  expect(financialAPI.fetchReport).toHaveBeenCalledTimes(2);
  report.unsubscribe(); store.dispatch(api.util.resetApiState());
});
test("failed refresh retains known data, while later successful refresh replaces it", async () => {
  const store = makeStore(); const report = store.dispatch(api.endpoints.getFinancialReport.initiate(args)); await report.unwrap();
  (financialAPI.fetchReport as jest.Mock).mockRejectedValueOnce(new Error("unavailable"));
  await store.dispatch(api.endpoints.getFinancialReport.initiate(args, { forceRefetch: true, subscribe: false }));
  expect(api.endpoints.getFinancialReport.select(args)(store.getState())).toMatchObject({ data, status: "rejected" });
  (financialAPI.fetchReport as jest.Mock).mockResolvedValueOnce({ success: true, data: { ...data, summary: { netSpent: 1300 } } });
  await store.dispatch(api.endpoints.getFinancialReport.initiate(args, { forceRefetch: true, subscribe: false }));
  expect(api.endpoints.getFinancialReport.select(args)(store.getState()).data?.summary.netSpent).toBe(1300);
  report.unsubscribe(); store.dispatch(api.util.resetApiState());
});
test("invalid or wrong-month report responses fail rather than becoming zeros", async () => {
  const store = makeStore();
  (financialAPI.fetchReport as jest.Mock).mockResolvedValueOnce({ success: false });
  await expect(store.dispatch(api.endpoints.getFinancialReport.initiate(args)).unwrap()).rejects.toBeDefined();
  (financialAPI.fetchReport as jest.Mock).mockResolvedValueOnce({ success: true, data });
  await expect(store.dispatch(api.endpoints.getFinancialReport.initiate({ ...args, currentMonth: 2 })).unwrap()).rejects.toBeDefined();
  store.dispatch(api.util.resetApiState());
});

test("observing new bank-sync completion refreshes reports once", async () => {
  const store = makeStore();
  store.dispatch(fetchPlaidItems.fulfilled([{ id: "bank", lastSyncedAt: "2026-02-18T00:00:00Z" } as any], "initial"));
  const report = store.dispatch(api.endpoints.getFinancialReport.initiate(args)); await report.unwrap();
  (plaidAPI.fetchItems as jest.Mock).mockResolvedValue({ data: { items: [{ id: "bank", lastSyncedAt: "2026-02-20T00:00:00Z" }] } });
  await store.dispatch(fetchPlaidItems()); await flush();
  expect(financialAPI.fetchReport).toHaveBeenCalledTimes(2);
  await store.dispatch(fetchPlaidItems()); await flush();
  expect(financialAPI.fetchReport).toHaveBeenCalledTimes(2);
  report.unsubscribe(); store.dispatch(api.util.resetApiState());
});
test("income baseline invalidation refreshes selected and later cached months", async () => {
  const store = makeStore();
  (financialAPI.fetchReport as jest.Mock).mockImplementation(async a => ({ success: true, data: { ...data, year: a.currentYear, month: a.currentMonth } }));
  const selected = store.dispatch(api.endpoints.getFinancialReport.initiate(args));
  const later = store.dispatch(api.endpoints.getFinancialReport.initiate({ ...args, currentMonth: 6 }));
  await Promise.all([selected.unwrap(), later.unwrap()]);
  store.dispatch(api.util.invalidateTags([{ type: "Summary" }])); await flush();
  expect(financialAPI.fetchReport).toHaveBeenCalledTimes(4);
  selected.unsubscribe(); later.unsubscribe(); store.dispatch(api.util.resetApiState());
});
