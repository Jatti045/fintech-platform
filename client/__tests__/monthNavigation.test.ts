/**
 * Month-navigation behavior tests — rewritten for the RTK Query data layer.
 *
 * The old suite drove the deleted thunks (`fetchTransaction`,
 * `fetchFinancialSummary`, `fetchBudgets`) plus the hand-rolled AsyncStorage
 * cache, and asserted against the removed slice state shapes. This version
 * exercises the same behaviors through `store/api/apiSlice` — the single
 * owner of month-scoped fetching — preserving every scenario:
 *
 *  1. initial load renders the selected month's complete financial state
 *  2. requests carry the correct month parameters
 *  3. switching months swaps ALL data with no cross-month leakage
 *  4. returning to a month restores its own data/currency exactly
 *  5. sequential + repeated navigation never corrupts state
 *  6. out-of-order / overlapping responses cannot contaminate any month
 *     (structurally guaranteed by per-month cache keys)
 *  7. empty months render empty; nothing leaks into them
 *  8. revisited months keep their backend-authoritative pagination metadata
 */

/// <reference types="jest" />

import { combineReducers, configureStore } from "@reduxjs/toolkit";

import api, { defaultTransactionArgs } from "@/store/api/apiSlice";
import type { GetTransactionsArgs } from "@/store/api/apiSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, {
  prevMonth,
  nextMonth,
  setMonthYear,
} from "@/store/slices/calendarSlice";

import transactionAPI from "@/api/transaction";
import budgetAPI from "@/api/budget";
import financialSummaryAPI from "@/api/financialSummary";

// ---------------------------------------------------------------------------
// Network is ENTIRELY mocked → no real requests, offline.
// ---------------------------------------------------------------------------

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
  default: {
    fetchSummary: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock month data — three months, all intentionally DIFFERENT.
// ---------------------------------------------------------------------------

const CURRENT = {
  key: "5-2026",
  month: 5,
  year: 2026,
  income: 5000,
  totalAmount: 2800,
  currency: "CAD",
  budgets: [
    {
      id: "b-current-groceries",
      date: new Date("2026-06-01"),
      category: "Groceries",
      limit: 1200,
      spent: 400,
      userId: "u1",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "b-current-transport",
      date: new Date("2026-06-01"),
      category: "Transport",
      limit: 600,
      spent: 150,
      userId: "u1",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "t-current-salary",
      name: "Salary",
      month: 5,
      year: 2026,
      category: "Income",
      amount: 5000,
      baseCurrency: "CAD",
      date: "2026-06-01T08:00:00.000Z",
      type: "INCOME",
    },
    {
      id: "t-current-groceries",
      name: "Weekly Groceries",
      month: 5,
      year: 2026,
      category: "Groceries",
      amount: 200,
      baseCurrency: "CAD",
      date: "2026-06-05T18:00:00.000Z",
      type: "EXPENSE",
      budgetId: "b-current-groceries",
    },
  ],
};

const PREV = {
  key: "4-2026",
  month: 4,
  year: 2026,
  income: 3200,
  totalAmount: 4100,
  currency: "USD",
  budgets: [
    {
      id: "b-prev-dining",
      date: new Date("2026-05-01"),
      category: "Dining",
      limit: 900,
      spent: 700,
      userId: "u1",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "t-prev-freelance",
      name: "Freelance Payout",
      month: 4,
      year: 2026,
      category: "Income",
      amount: 3200,
      baseCurrency: "USD",
      date: "2026-05-01T08:00:00.000Z",
      type: "INCOME",
    },
    {
      id: "t-prev-dining-1",
      name: "Dinner",
      month: 4,
      year: 2026,
      category: "Dining",
      amount: 350,
      baseCurrency: "USD",
      date: "2026-05-03T19:00:00.000Z",
      type: "EXPENSE",
      budgetId: "b-prev-dining",
    },
    {
      id: "t-prev-dining-2",
      name: "Lunch Out",
      month: 4,
      year: 2026,
      category: "Dining",
      amount: 120,
      baseCurrency: "USD",
      date: "2026-05-07T13:00:00.000Z",
      type: "EXPENSE",
      budgetId: "b-prev-dining",
    },
  ],
};

// Edge cases: an older month with a very different income and NO transactions
// and NO budgets.
const TWO_AGO = {
  key: "3-2026",
  month: 3,
  year: 2026,
  income: 0,
  totalAmount: 0,
  currency: "EUR",
  budgets: [],
  transactions: [],
};

const MONTHS: Record<string, typeof CURRENT> = {
  [CURRENT.key]: CURRENT,
  [PREV.key]: PREV,
  [TWO_AGO.key]: TWO_AGO,
};

const monthKey = (month: number, year: number) => `${month}-${year}`;

// ---------------------------------------------------------------------------
// Mock "backend" response builders (shape matches the real API layer).
// ---------------------------------------------------------------------------

function txEnvelope(
  month: typeof CURRENT,
  pagination?: Record<string, unknown>,
) {
  return {
    success: true,
    message: "ok",
    data: {
      transaction: month.transactions,
      pagination: pagination ?? {
        currentPage: 1,
        totalPages: 1,
        totalCount: month.transactions.length,
        hasNextPage: false,
        hasPrevPage: false,
        limit: 20,
      },
    },
  };
}

function txResponse(month: typeof CURRENT) {
  return txEnvelope(month);
}

function summaryResponse(month: typeof CURRENT) {
  return {
    success: true,
    message: "ok",
    data: {
      totalAmount: month.totalAmount,
      monthlyIncome: month.income,
      expectedIncome: month.income,
      actualIncome: 0,
      netSpent: month.totalAmount,
      netRemaining: month.income - month.totalAmount,
      spentPercentageOfIncome:
        month.income > 0 ? (month.totalAmount / month.income) * 100 : 0,
    },
  };
}

const budgetResponse = (month: typeof CURRENT) => ({
  success: true,
  message: "ok",
  data: month.budgets,
});

// ---------------------------------------------------------------------------
// Store + navigation driver (mirrors how components consume the API slice).
// ---------------------------------------------------------------------------

const rootReducer = combineReducers({
  user: userReducer,
  calendar: calendarReducer,
  [api.reducerPath]: api.reducer,
});

function makeStore(userCurrency = "CAD") {
  return configureStore({
    reducer: rootReducer,
    preloadedState: {
      user: {
        user: {
          id: "u1",
          username: "test",
          email: "test@example.com",
          currency: userCurrency,
        },
        token: "test-token",
        isLoading: false,
        isAuthenticated: true,
        error: null,
        loginError: null,
        signupError: null,
      },
    } as any,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });
}

type TestStore = ReturnType<typeof makeStore>;

/** Query args identical to what the production hooks subscribe with. */
const txArgs = (month: number, year: number): GetTransactionsArgs =>
  defaultTransactionArgs(month, year);

const selectTx = (store: TestStore, month: number, year: number) =>
  api.endpoints.getTransactions.select(txArgs(month, year))(store.getState());

const selectBudgets = (store: TestStore, month: number, year: number) =>
  api.endpoints.getBudgets.select({ currentMonth: month, currentYear: year })(
    store.getState(),
  );

const selectSummary = (store: TestStore, month: number, year: number) =>
  api.endpoints.getFinancialSummary.select({
    currentMonth: month,
    currentYear: year,
  })(store.getState());

const transactionsOf = (store: TestStore, month: number, year: number) =>
  selectTx(store, month, year).data?.transaction ?? [];

const budgetsOf = (store: TestStore, month: number, year: number) =>
  selectBudgets(store, month, year).data ?? [];

/** Load the given month exactly like the Home/tabs subscriptions do. */
async function loadMonth(store: TestStore, month: number, year: number) {
  await Promise.all([
    store
      .dispatch(api.endpoints.getTransactions.initiate(txArgs(month, year)))
      .unwrap(),
    store
      .dispatch(
        api.endpoints.getFinancialSummary.initiate({
          currentMonth: month,
          currentYear: year,
        }),
      )
      .unwrap(),
    store
      .dispatch(
        api.endpoints.getBudgets.initiate({
          currentMonth: month,
          currentYear: year,
        }),
      )
      .unwrap(),
  ]);
}

/** Navigate one month backward and load it. */
async function goPrev(store: TestStore) {
  store.dispatch(prevMonth());
  const { month, year } = store.getState().calendar;
  await loadMonth(store, month, year);
}

/** Navigate one month forward and load it. */
async function goNext(store: TestStore) {
  store.dispatch(nextMonth());
  const { month, year } = store.getState().calendar;
  await loadMonth(store, month, year);
}

beforeEach(() => {
  // Default mocks: the fake backend returns per-month data based on the
  // requested month/year, exactly like a real server would.
  (transactionAPI.fetchAll as jest.Mock).mockImplementation(
    async ({ currentMonth, currentYear }: any) =>
      txResponse(MONTHS[monthKey(currentMonth, currentYear)]),
  );
  (financialSummaryAPI.fetchSummary as jest.Mock).mockImplementation(
    async ({ currentMonth, currentYear }: any) =>
      summaryResponse(MONTHS[monthKey(currentMonth, currentYear)]),
  );
  (budgetAPI.fetchAll as jest.Mock).mockImplementation(
    async ({ currentMonth, currentYear }: any) =>
      budgetResponse(MONTHS[monthKey(currentMonth, currentYear)]),
  );
});

afterEach(() => {
  jest.clearAllMocks();
});


// ---------------------------------------------------------------------------
// 1. Initial month loading
// ---------------------------------------------------------------------------

describe("month navigation – initial load", () => {
  it("loads and displays the current month's complete financial state", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    // Calendar
    expect(store.getState().calendar.month).toBe(5);
    expect(store.getState().calendar.year).toBe(2026);

    // Monthly income (HomePulse "Income")
    expect(selectSummary(store, 5, 2026).data?.totalAmount).toBe(2800);

    // Currency (HomePulse uses user.currency)
    expect((store.getState() as any).user.user.currency).toBe("CAD");

    // Transactions (RecentFlow)
    const txs = transactionsOf(store, 5, 2026);
    expect(txs).toHaveLength(2);
    expect(txs.map((t: any) => t.id)).toEqual([
      "t-current-salary",
      "t-current-groceries",
    ]);
    expect(txs[0].amount).toBe(5000);
    expect(txs[0].baseCurrency).toBe("CAD");
    expect(txs[1].name).toBe("Weekly Groceries");
    expect(txs[1].amount).toBe(200);

    // Budgets (BudgetPulse)
    const budgets = budgetsOf(store, 5, 2026);
    expect(budgets).toHaveLength(2);
    expect(budgets.map((b: any) => b.category)).toEqual([
      "Groceries",
      "Transport",
    ]);
    expect(budgets[0].limit).toBe(1200);
    expect(budgets[0].spent).toBe(400);
    expect(budgets[1].limit).toBe(600);
  });

  it("requests the correct month's data from the API", async () => {
    const store = makeStore();
    await loadMonth(store, CURRENT.month, CURRENT.year);

    expect(transactionAPI.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({
        currentMonth: 5,
        currentYear: 2026,
        page: 1,
        searchQuery: "",
      }),
    );
    expect(financialSummaryAPI.fetchSummary).toHaveBeenCalledWith({
      currentMonth: 5,
      currentYear: 2026,
    });
    expect(budgetAPI.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ currentMonth: 5, currentYear: 2026 }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Changing to a previous month
// ---------------------------------------------------------------------------

describe("month navigation – previous month", () => {
  it("switches all data to the previous month with no current-month leakage", async () => {
    const store = makeStore("USD");
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    await goPrev(store);

    // Calendar moved back one month
    expect(store.getState().calendar.month).toBe(4);
    expect(store.getState().calendar.year).toBe(2026);

    // Income changed to prev month's income
    expect(selectSummary(store, 4, 2026).data?.totalAmount).toBe(4100);

    // The selected month reads prev-month transactions — no current leakage
    const txs = transactionsOf(store, 4, 2026);
    expect(txs).toHaveLength(3);
    expect(txs.map((t: any) => t.id)).toEqual([
      "t-prev-freelance",
      "t-prev-dining-1",
      "t-prev-dining-2",
    ]);
    expect(txs.some((t: any) => t.id.startsWith("t-current-"))).toBe(false);
    expect(txs.every((t: any) => t.baseCurrency === "USD")).toBe(true);

    // Budgets swapped to the previous month's set
    const budgets = budgetsOf(store, 4, 2026);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].id).toBe("b-prev-dining");
    expect(budgets[0].category).toBe("Dining");
    expect(budgets[0].limit).toBe(900);
    expect(
      budgets.some((b: any) => b.id.startsWith("b-current-")),
    ).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// 3. Current → Previous → Current (stale-state / currency restore)
// ---------------------------------------------------------------------------

describe("month navigation – current → previous → current", () => {
  it("restores the current month's data and does not retain the previous currency", async () => {
    const store = makeStore("CAD");
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    // Current month: CAD
    expect((store.getState() as any).user.user.currency).toBe("CAD");
    expect(transactionsOf(store, 5, 2026)[0].baseCurrency).toBe("CAD");

    // -> Previous month: USD
    await goPrev(store);
    expect(
      transactionsOf(store, 4, 2026).every((t: any) => t.baseCurrency === "USD"),
    ).toBe(true);
    expect(selectSummary(store, 4, 2026).data?.monthlyIncome).toBe(3200);

    // -> Back to current month: must be CAD again
    await goNext(store);

    expect(store.getState().calendar.month).toBe(5);
    expect(store.getState().calendar.year).toBe(2026);

    // Income restored
    expect(selectSummary(store, 5, 2026).data?.totalAmount).toBe(2800);

    // Currency restored to CAD — NOT retaining USD from the previous visit
    expect((store.getState() as any).user.user.currency).toBe("CAD");
    expect(
      transactionsOf(store, 5, 2026).every((t: any) => t.baseCurrency === "CAD"),
    ).toBe(true);
    expect(
      transactionsOf(store, 5, 2026).some((t: any) => t.baseCurrency === "USD"),
    ).toBe(false);

    // Transactions restored (current month only)
    expect(transactionsOf(store, 5, 2026).map((t: any) => t.id)).toEqual([
      "t-current-salary",
      "t-current-groceries",
    ]);

    // Budgets restored
    expect(budgetsOf(store, 5, 2026).map((b: any) => b.category)).toEqual([
      "Groceries",
      "Transport",
    ]);
    expect(
      budgetsOf(store, 5, 2026).some((b: any) => b.id === "b-prev-dining"),
    ).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// 4. Multiple sequential month changes
// ---------------------------------------------------------------------------

describe("month navigation – sequential changes", () => {
  it("reflects the correct month after every navigation in a sequence", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    // Current → Previous
    await goPrev(store);
    expect(selectSummary(store, 4, 2026).data?.monthlyIncome).toBe(3200);
    expect(store.getState().calendar.month).toBe(4);

    // Previous → Two months ago (empty edge-case month)
    await goPrev(store);
    expect(store.getState().calendar.month).toBe(3);
    expect(selectSummary(store, 3, 2026).data?.monthlyIncome).toBe(0);
    expect(transactionsOf(store, 3, 2026)).toHaveLength(0);
    expect(budgetsOf(store, 3, 2026)).toHaveLength(0);

    // Two months ago → Previous
    await goNext(store);
    expect(store.getState().calendar.month).toBe(4);
    expect(transactionsOf(store, 4, 2026)).toHaveLength(3);
    expect(budgetsOf(store, 4, 2026)).toHaveLength(1);

    // Previous → Current
    await goNext(store);
    expect(store.getState().calendar.month).toBe(5);
    expect(transactionsOf(store, 5, 2026)).toHaveLength(2);
    expect(
      transactionsOf(store, 5, 2026).every((t: any) => t.baseCurrency === "CAD"),
    ).toBe(true);
    expect(budgetsOf(store, 5, 2026)).toHaveLength(2);
  });

  it("handles repeated back-and-forth navigation without data corruption", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    // A quick back-and-forth series
    for (let i = 0; i < 3; i += 1) {
      await goPrev(store);
      expect(selectSummary(store, 4, 2026).data?.monthlyIncome).toBe(3200);
      await goNext(store);
      expect(selectSummary(store, 5, 2026).data?.monthlyIncome).toBe(5000);
    }

    expect(store.getState().calendar.month).toBe(5);
    expect(transactionsOf(store, 5, 2026)).toHaveLength(2);
    expect(budgetsOf(store, 5, 2026)).toHaveLength(2);
  });
});


// ---------------------------------------------------------------------------
// 5. Race conditions / out-of-order responses
//
// The old architecture needed a `latestRequestId` guard for these. RTK Query
// keys each month's data under its own cache entry, so a late response for
// one month can only ever land in that month's entry — the tests below pin
// that structural guarantee.
// ---------------------------------------------------------------------------

describe("month navigation – request races / out-of-order responses", () => {
  it("cannot let a stale earlier-month response contaminate the newer month", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );

    const deferreds: {
      month: number;
      resolve: (v: unknown) => void;
      promise: Promise<unknown>;
    }[] = [];

    (transactionAPI.fetchAll as jest.Mock).mockImplementation(
      ({ currentMonth }: { currentMonth: number }) => {
        let resolve!: (v: unknown) => void;
        const promise = new Promise((res) => {
          resolve = res;
        });
        deferreds.push({ month: currentMonth, resolve, promise });
        return promise;
      },
    );

    // Start the CURRENT-month request, then the PREV-month request (newer).
    const currentReq = store.dispatch(
      api.endpoints.getTransactions.initiate(txArgs(CURRENT.month, CURRENT.year)),
    );
    const prevReq = store.dispatch(
      api.endpoints.getTransactions.initiate(txArgs(PREV.month, PREV.year)),
    );

    // The NEWER (prev) request resolves first…
    deferreds.find((d) => d.month === PREV.month)!.resolve(txResponse(PREV));
    await prevReq.unwrap();

    // …then the OLDER (current) request resolves LAST. It must land only in
    // the current-month entry and never overwrite the selected month.
    deferreds
      .find((d) => d.month === CURRENT.month)!
      .resolve(txResponse(CURRENT));
    await currentReq.unwrap();

    // Selected month (PREV) holds its own data, untouched:
    const prevTxs = transactionsOf(store, PREV.month, PREV.year);
    expect(prevTxs).toHaveLength(3);
    expect(prevTxs.every((t: any) => t.baseCurrency === "USD")).toBe(true);
    expect(
      prevTxs.some((t: any) => t.id.startsWith("t-current-")),
    ).toBe(false);

    // …and the stale response still populated ITS OWN month's entry correctly.
    const currentTxs = transactionsOf(store, CURRENT.month, CURRENT.year);
    expect(currentTxs).toHaveLength(2);
    expect(currentTxs.every((t: any) => t.baseCurrency === "CAD")).toBe(true);
  });

  it("keeps the final selected month's data when rapid navigation overlaps", async () => {
    const store = makeStore("CAD");
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );

    const queue: ((v: unknown) => void)[] = [];
    (transactionAPI.fetchAll as jest.Mock).mockImplementation(() => {
      return new Promise((res) => queue.push(res));
    });

    // Rapid current → prev → current. The two identical CURRENT dispatches
    // share one deduplicated request, so exactly two network calls occur.
    const req1 = store.dispatch(
      api.endpoints.getTransactions.initiate(txArgs(CURRENT.month, CURRENT.year)),
    );
    const req2 = store.dispatch(
      api.endpoints.getTransactions.initiate(txArgs(PREV.month, PREV.year)),
    );
    store.dispatch(
      api.endpoints.getTransactions.initiate(txArgs(CURRENT.month, CURRENT.year)),
    );
    expect(queue).toHaveLength(2);

    // Resolve out of order: prev first, then the (still selected) current.
    queue[1](txResponse(PREV));
    await req2.unwrap();
    queue[0](txResponse(CURRENT));
    await req1.unwrap();

    // Final selected month = CURRENT → its entry holds CAD data.
    const currentTxs = transactionsOf(store, CURRENT.month, CURRENT.year);
    expect(currentTxs).toHaveLength(2);
    expect(currentTxs.every((t: any) => t.baseCurrency === "CAD")).toBe(true);
    expect(currentTxs.some((t: any) => t.id.startsWith("t-prev-"))).toBe(false);

    // Prev's late-resolving data stayed confined to its own month.
    const prevTxs = transactionsOf(store, PREV.month, PREV.year);
    expect(prevTxs).toHaveLength(3);
    expect(prevTxs.every((t: any) => t.baseCurrency === "USD")).toBe(true);

    // Budgets are isolated per month too.
    const budgetDeferreds: { month: number; resolve: (v: unknown) => void }[] =
      [];
    (budgetAPI.fetchAll as jest.Mock).mockImplementation(
      ({ currentMonth }: { currentMonth: number }) =>
        new Promise((res) =>
          budgetDeferreds.push({ month: currentMonth, resolve: res }),
        ),
    );

    const budgetPrev = store.dispatch(
      api.endpoints.getBudgets.initiate({
        currentMonth: PREV.month,
        currentYear: PREV.year,
      }),
    );
    const budgetCurrent = store.dispatch(
      api.endpoints.getBudgets.initiate({
        currentMonth: CURRENT.month,
        currentYear: CURRENT.year,
      }),
    );

    // Resolve in an order that would corrupt shared state without isolation:
    // CURRENT first, stale PREV last.
    budgetDeferreds
      .find((d) => d.month === CURRENT.month)!
      .resolve(budgetResponse(CURRENT));
    await budgetCurrent.unwrap();
    budgetDeferreds
      .find((d) => d.month === PREV.month)!
      .resolve(budgetResponse(PREV));
    await budgetPrev.unwrap();

    expect(budgetsOf(store, CURRENT.month, CURRENT.year)).toHaveLength(2);
    expect(
      budgetsOf(store, CURRENT.month, CURRENT.year).some(
        (b: any) => b.id === "b-prev-dining",
      ),
    ).toBe(false);
    expect(budgetsOf(store, PREV.month, PREV.year)).toHaveLength(1);
  });
});


// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------

describe("month navigation – edge cases", () => {
  it("displays an empty month (no transactions or budgets) correctly", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: TWO_AGO.month, year: TWO_AGO.year }) as any,
    );
    await loadMonth(store, TWO_AGO.month, TWO_AGO.year);

    expect(selectSummary(store, 3, 2026).data?.monthlyIncome).toBe(0);
    expect(selectSummary(store, 3, 2026).data?.totalAmount).toBe(0);
    expect(transactionsOf(store, 3, 2026)).toHaveLength(0);
    expect(budgetsOf(store, 3, 2026)).toHaveLength(0);
  });

  it("does not leak data when navigating from a full month into an empty month", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    // Jump directly to the empty older month.
    store.dispatch(
      setMonthYear({ month: TWO_AGO.month, year: TWO_AGO.year }) as any,
    );
    await loadMonth(store, TWO_AGO.month, TWO_AGO.year);

    expect(transactionsOf(store, 3, 2026)).toHaveLength(0);
    expect(budgetsOf(store, 3, 2026)).toHaveLength(0);
    expect(selectSummary(store, 3, 2026).data?.monthlyIncome).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Cached pagination metadata stays authoritative
//
// Regression pin for Audit #1's core bug: a cached month must never claim
// `totalPages: 1` / `hasNextPage: false` when more pages exist server-side.
// ---------------------------------------------------------------------------

describe("month navigation – cached pagination metadata", () => {
  it("a revisited month serves its cached entry with the backend-authoritative pagination envelope intact", async () => {
    // PREV has three pages of transactions server-side; only page 1 loaded.
    (transactionAPI.fetchAll as jest.Mock).mockImplementation(
      async ({ currentMonth, currentYear }: any) =>
        monthKey(currentMonth, currentYear) === PREV.key
          ? txEnvelope(PREV, {
              currentPage: 1,
              totalPages: 3,
              totalCount: 45,
              hasNextPage: true,
              hasPrevPage: false,
              limit: 20,
            })
          : txResponse(MONTHS[monthKey(currentMonth, currentYear)]),
    );

    const store = makeStore();
    store.dispatch(setMonthYear({ month: PREV.month, year: PREV.year }));
    await loadMonth(store, PREV.month, PREV.year);
    expect(selectTx(store, 4, 2026).data?.pagination).toMatchObject({
      currentPage: 1,
      totalPages: 3,
      totalCount: 45,
      hasNextPage: true,
    });

    // Leave the month and come back — the cached entry is served without a
    // refetch (in-session revisit), and it must retain the REAL pagination
    // metadata verbatim. A cached month must never claim totalPages: 1 /
    // hasNextPage: false when more pages exist server-side. Cold-start
    // freshness is handled separately by hydrateApiCache's tag invalidation.
    await goPrev(store); // → TWO_AGO (empty month)
    await goNext(store); // → back to PREV

    expect(transactionAPI.fetchAll).toHaveBeenCalledTimes(2); // no third call
    const pagination = selectTx(store, 4, 2026).data?.pagination;
    expect(pagination).toMatchObject({
      currentPage: 1,
      totalPages: 3,
      totalCount: 45,
      hasNextPage: true,
    });
  });
});

