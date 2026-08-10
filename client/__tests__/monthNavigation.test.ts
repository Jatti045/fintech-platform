import { combineReducers, configureStore } from "@reduxjs/toolkit";

import userReducer from "@/store/slices/userSlice";
import transactionReducer, {
  fetchTransaction,
} from "@/store/slices/transactionSlice";
import themeReducer from "@/store/slices/themeSlice";
import budgetReducer, { fetchBudgets } from "@/store/slices/budgetSlice";
import calendarReducer, {
  prevMonth,
  nextMonth,
  setMonthYear,
} from "@/store/slices/calendarSlice";
import goalReducer, { fetchGoals } from "@/store/slices/goalSlice";
import notificationReducer from "@/store/slices/notificationSlice";

import transactionAPI from "../api/transaction";
import budgetAPI from "../api/budget";
import goalAPI from "../api/goal";

// ---------------------------------------------------------------------------
// Network + cache are ENTIRELY mocked → no real requests, no real DB, offline.
// ---------------------------------------------------------------------------
jest.mock("../api/transaction", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("../api/budget", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("../api/goal", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    allocate: jest.fn(),
    deallocate: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("../utils/cache", () => ({
  getTransactionsCache: jest.fn(),
  setTransactionsCache: jest.fn(),
  appendTransactionToCache: jest.fn(),
  removeTransactionFromCacheById: jest.fn(),
  removeTransactionFromCacheByIdAcrossAllMonths: jest.fn(),
  getGoalAllocationsTotalCache: jest.fn(),
  getBudgetsCache: jest.fn(),
  setBudgetsCache: jest.fn(),
  appendBudgetToCache: jest.fn(),
  removeBudgetFromCacheById: jest.fn(),
  removeBudgetFromCacheByIdAcrossAllMonths: jest.fn(),
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
      icon: "shopping-cart",
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
      icon: "car",
      limit: 600,
      spent: 150,
      userId: "u1",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  goals: [
    {
      id: "g-current-emergency",
      userId: "u1",
      name: "Emergency Fund",
      target: 10000,
      progress: 2500,
      remaining: 7500,
      achieved: false,
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
      icon: "coffee",
      limit: 900,
      spent: 700,
      userId: "u1",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  goals: [
    {
      id: "g-prev-vacation",
      userId: "u1",
      name: "Vacation",
      target: 5000,
      progress: 3000,
      remaining: 2000,
      achieved: false,
    },
    {
      id: "g-prev-laptop",
      userId: "u1",
      name: "New Laptop",
      target: 2000,
      progress: 800,
      remaining: 1200,
      achieved: false,
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

// Edge cases: an older month with a very different income and NO transactions,
// NO budgets and NO goals.
const TWO_AGO = {
  key: "3-2026",
  month: 3,
  year: 2026,
  income: 0,
  totalAmount: 0,
  currency: "EUR",
  budgets: [],
  goals: [],
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

function txResponse(month: typeof CURRENT) {
  return {
    success: true,
    message: "ok",
    data: {
      transaction: month.transactions,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: month.transactions.length,
        hasNextPage: false,
        hasPrevPage: false,
        limit: 20,
      },
      summary: {
        // includesGoalAllocations: true → the slice skips the cache fallback,
        // keeping the tests deterministic and offline.
        includesGoalAllocations: true,
        totalAmount: month.totalAmount,
        monthlyIncome: month.income,
        netSpent: month.totalAmount,
        netRemaining: month.income - month.totalAmount,
        spentPercentageOfIncome:
          month.income > 0 ? (month.totalAmount / month.income) * 100 : 0,
      },
    },
  };
}

const budgetResponse = (month: typeof CURRENT) => ({
  success: true,
  message: "ok",
  data: month.budgets,
});

const goalResponse = (month: typeof CURRENT) => ({
  success: true,
  message: "ok",
  data: month.goals,
});

// ---------------------------------------------------------------------------
// Store + navigation driver (mirrors the real app effects).
// ---------------------------------------------------------------------------

const rootReducer = combineReducers({
  user: userReducer,
  transaction: transactionReducer,
  budget: budgetReducer,
  goal: goalReducer,
  calendar: calendarReducer,
  theme: themeReducer,
  notifications: notificationReducer,
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
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  });
}

type TestStore = ReturnType<typeof makeStore>;

/** Load the given month exactly like the Home/tabs effects do. */
async function loadMonth(store: TestStore, month: number, year: number) {
  await Promise.all([
    store.dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: month,
        currentYear: year,
        page: 1,
        limit: 20,
        useCache: false,
      }) as any,
    ),
    store.dispatch(
      fetchBudgets({ currentMonth: month, currentYear: year }) as any,
    ),
    store.dispatch(
      fetchGoals({ currentMonth: month, currentYear: year }) as any,
    ),
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
  (budgetAPI.fetchAll as jest.Mock).mockImplementation(
    async ({ currentMonth, currentYear }: any) =>
      budgetResponse(MONTHS[monthKey(currentMonth, currentYear)]),
  );
  (goalAPI.fetchAll as jest.Mock).mockImplementation(
    async ({ currentMonth, currentYear }: any) =>
      goalResponse(MONTHS[monthKey(currentMonth, currentYear)]),
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

    const state = store.getState() as any;

    // Calendar
    expect(state.calendar.month).toBe(5);
    expect(state.calendar.year).toBe(2026);

    // Monthly income (HomePulse "Income")
    expect(state.transaction.monthSummary.monthlyIncome).toBe(5000);
    expect(state.transaction.monthSummary.totalAmount).toBe(2800);

    // Currency (HomePulse uses user.currency)
    expect(state.user.user.currency).toBe("CAD");

    // Transactions (RecentFlow)
    expect(state.transaction.transactions).toHaveLength(2);
    expect(state.transaction.transactions.map((t: any) => t.id)).toEqual([
      "t-current-salary",
      "t-current-groceries",
    ]);
    expect(state.transaction.transactions[0].amount).toBe(5000);
    expect(state.transaction.transactions[0].baseCurrency).toBe("CAD");
    expect(state.transaction.transactions[1].name).toBe("Weekly Groceries");
    expect(state.transaction.transactions[1].amount).toBe(200);

    // Budgets (BudgetPulse)
    expect(state.budget.budgets).toHaveLength(2);
    expect(state.budget.budgets.map((b: any) => b.category)).toEqual([
      "Groceries",
      "Transport",
    ]);
    expect(state.budget.budgets[0].limit).toBe(1200);
    expect(state.budget.budgets[0].spent).toBe(400);
    expect(state.budget.budgets[1].limit).toBe(600);

    // Goals (GoalPulse)
    expect(state.goal.goals).toHaveLength(1);
    expect(state.goal.goals[0].name).toBe("Emergency Fund");
    expect(state.goal.goals[0].target).toBe(10000);
    expect(state.goal.goals[0].progress).toBe(2500);
  });

  it("requests the correct month's data from the API", async () => {
    const store = makeStore();
    await loadMonth(store, CURRENT.month, CURRENT.year);

    expect(transactionAPI.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ currentMonth: 5, currentYear: 2026 }),
    );
    expect(budgetAPI.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ currentMonth: 5, currentYear: 2026 }),
    );
    expect(goalAPI.fetchAll).toHaveBeenCalledWith(
      expect.objectContaining({ currentMonth: 5, currentYear: 2026 }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Changing to a previous month
// ---------------------------------------------------------------------------

describe("month navigation – previous month", () => {
  it("switches all data to the previous month with no current-month leakage", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );
    await loadMonth(store, CURRENT.month, CURRENT.year);

    await goPrev(store);

    const state = store.getState() as any;

    // Calendar moved back one month
    expect(state.calendar.month).toBe(4);
    expect(state.calendar.year).toBe(2026);

    // Income changed to prev month's income
    expect(state.transaction.monthSummary.monthlyIncome).toBe(3200);
    expect(state.transaction.monthSummary.totalAmount).toBe(4100);

    // Transactions replaced — no current-month transactions remain
    expect(state.transaction.transactions).toHaveLength(3);
    expect(state.transaction.transactions.map((t: any) => t.id)).toEqual([
      "t-prev-freelance",
      "t-prev-dining-1",
      "t-prev-dining-2",
    ]);
    expect(
      state.transaction.transactions.some((t: any) =>
        t.id.startsWith("t-current-"),
      ),
    ).toBe(false);
    expect(
      state.transaction.transactions.every(
        (t: any) => t.baseCurrency === "USD",
      ),
    ).toBe(true);

    // Budgets replaced
    expect(state.budget.budgets).toHaveLength(1);
    expect(state.budget.budgets[0].id).toBe("b-prev-dining");
    expect(state.budget.budgets[0].category).toBe("Dining");
    expect(state.budget.budgets[0].limit).toBe(900);
    expect(
      state.budget.budgets.some((b: any) => b.id.startsWith("b-current-")),
    ).toBe(false);

    // Goals replaced
    expect(state.goal.goals).toHaveLength(2);
    expect(state.goal.goals.map((g: any) => g.id)).toEqual([
      "g-prev-vacation",
      "g-prev-laptop",
    ]);
    expect(
      state.goal.goals.some((g: any) => g.id.startsWith("g-current-")),
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
    expect(
      (store.getState() as any).transaction.transactions[0].baseCurrency,
    ).toBe("CAD");

    // -> Previous month: USD
    await goPrev(store);
    expect(
      (store.getState() as any).transaction.transactions.every(
        (t: any) => t.baseCurrency === "USD",
      ),
    ).toBe(true);
    expect(
      (store.getState() as any).transaction.monthSummary.monthlyIncome,
    ).toBe(3200);

    // -> Back to current month: must be CAD again
    await goNext(store);
    const state = store.getState() as any;

    expect(state.calendar.month).toBe(5);
    expect(state.calendar.year).toBe(2026);

    // Income restored
    expect(state.transaction.monthSummary.monthlyIncome).toBe(5000);
    expect(state.transaction.monthSummary.totalAmount).toBe(2800);

    // Currency restored to CAD — NOT retaining USD from the previous visit
    expect(state.user.user.currency).toBe("CAD");
    expect(
      state.transaction.transactions.every(
        (t: any) => t.baseCurrency === "CAD",
      ),
    ).toBe(true);
    expect(
      state.transaction.transactions.some((t: any) => t.baseCurrency === "USD"),
    ).toBe(false);

    // Transactions restored (current month only)
    expect(state.transaction.transactions).toHaveLength(2);
    expect(state.transaction.transactions.map((t: any) => t.id)).toEqual([
      "t-current-salary",
      "t-current-groceries",
    ]);

    // Budgets restored
    expect(state.budget.budgets).toHaveLength(2);
    expect(state.budget.budgets.map((b: any) => b.category)).toEqual([
      "Groceries",
      "Transport",
    ]);
    expect(
      state.budget.budgets.some((b: any) => b.id === "b-prev-dining"),
    ).toBe(false);

    // Goals restored
    expect(state.goal.goals).toHaveLength(1);
    expect(state.goal.goals[0].id).toBe("g-current-emergency");
    expect(state.goal.goals.some((g: any) => g.id === "g-prev-vacation")).toBe(
      false,
    );
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
    expect(
      (store.getState() as any).transaction.monthSummary.monthlyIncome,
    ).toBe(3200);
    expect((store.getState() as any).calendar.month).toBe(4);

    // Previous → Two months ago (empty edge-case month)
    await goPrev(store);
    let state = store.getState() as any;
    expect(state.calendar.month).toBe(3);
    expect(state.transaction.monthSummary.monthlyIncome).toBe(0);
    expect(state.transaction.transactions).toHaveLength(0);
    expect(state.budget.budgets).toHaveLength(0);
    expect(state.goal.goals).toHaveLength(0);

    // Two months ago → Previous
    await goNext(store);
    state = store.getState() as any;
    expect(state.calendar.month).toBe(4);
    expect(state.transaction.monthSummary.monthlyIncome).toBe(3200);
    expect(state.transaction.transactions).toHaveLength(3);
    expect(state.budget.budgets).toHaveLength(1);
    expect(state.goal.goals).toHaveLength(2);

    // Previous → Current
    await goNext(store);
    state = store.getState() as any;
    expect(state.calendar.month).toBe(5);
    expect(state.transaction.monthSummary.monthlyIncome).toBe(5000);
    expect(state.transaction.transactions).toHaveLength(2);
    expect(
      state.transaction.transactions.every(
        (t: any) => t.baseCurrency === "CAD",
      ),
    ).toBe(true);
    expect(state.budget.budgets).toHaveLength(2);
    expect(state.goal.goals).toHaveLength(1);
    expect(state.goal.goals[0].id).toBe("g-current-emergency");
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
      expect(
        (store.getState() as any).transaction.monthSummary.monthlyIncome,
      ).toBe(3200);
      await goNext(store);
      expect(
        (store.getState() as any).transaction.monthSummary.monthlyIncome,
      ).toBe(5000);
    }

    const state = store.getState() as any;
    expect(state.calendar.month).toBe(5);
    expect(state.transaction.monthSummary.monthlyIncome).toBe(5000);
    expect(state.transaction.transactions).toHaveLength(2);
    expect(state.budget.budgets).toHaveLength(2);
    expect(state.goal.goals).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Race conditions / out-of-order responses (latest-request-wins)
// ---------------------------------------------------------------------------

describe("month navigation – request races / out-of-order responses", () => {
  it("ignores a stale earlier-month response that resolves after a newer one", async () => {
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
      fetchTransaction({
        searchQuery: "",
        currentMonth: CURRENT.month,
        currentYear: CURRENT.year,
        page: 1,
        limit: 20,
        useCache: false,
      }) as any,
    );
    const prevReq = store.dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: PREV.month,
        currentYear: PREV.year,
        page: 1,
        limit: 20,
        useCache: false,
      }) as any,
    );

    // The NEWER (prev) request resolves first…
    const prevDeferred = deferreds.find((d) => d.month === PREV.month)!;
    prevDeferred.resolve(txResponse(PREV));
    await prevReq;

    // …then the OLDER (current) request resolves LAST. It must be ignored.
    const currentDeferred = deferreds.find((d) => d.month === CURRENT.month)!;
    currentDeferred.resolve(txResponse(CURRENT));
    await currentReq;

    const state = store.getState() as any;
    // The finally selected month was PREV → its data must win, untouched by the
    // stale current-month response that arrived out of order.
    expect(state.transaction.monthSummary.monthlyIncome).toBe(3200);
    expect(state.transaction.transactions).toHaveLength(3);
    expect(
      state.transaction.transactions.every(
        (t: any) => t.baseCurrency === "USD",
      ),
    ).toBe(true);
    expect(
      state.transaction.transactions.some((t: any) =>
        t.id.startsWith("t-current-"),
      ),
    ).toBe(false);
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

    // Rapid current → prev → current (three overlapping requests).
    const req1 = store.dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: CURRENT.month,
        currentYear: CURRENT.year,
        page: 1,
        limit: 20,
        useCache: false,
      }) as any,
    );
    const req2 = store.dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: PREV.month,
        currentYear: PREV.year,
        page: 1,
        limit: 20,
        useCache: false,
      }) as any,
    );
    const req3 = store.dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: CURRENT.month,
        currentYear: CURRENT.year,
        page: 1,
        limit: 20,
        useCache: false,
      }) as any,
    );

    // Resolve out of order: req2 (prev) first, then req1 (stale current),
    // then req3 (the final/selected current). Only req3 may win.
    queue[1](txResponse(PREV));
    await req2;
    queue[0](txResponse(CURRENT));
    await req1;
    queue[2](txResponse(CURRENT));
    await req3;

    const state = store.getState() as any;
    // Final selected month = CURRENT → CAD, income 5000, current budgets.
    expect(state.transaction.monthSummary.monthlyIncome).toBe(5000);
    expect(state.transaction.transactions).toHaveLength(2);
    expect(
      state.transaction.transactions.every(
        (t: any) => t.baseCurrency === "CAD",
      ),
    ).toBe(true);
    expect(
      state.transaction.transactions.some((t: any) => t.baseCurrency === "USD"),
    ).toBe(false);
  });
  it("applies latest-request-wins to budgets and goals too", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: CURRENT.month, year: CURRENT.year }) as any,
    );

    const budgetDeferreds: {
      month: number;
      resolve: (v: unknown) => void;
    }[] = [];
    const goalDeferreds: {
      month: number;
      resolve: (v: unknown) => void;
    }[] = [];

    (budgetAPI.fetchAll as jest.Mock).mockImplementation(
      ({ currentMonth }: { currentMonth: number }) =>
        new Promise((res) =>
          budgetDeferreds.push({ month: currentMonth, resolve: res }),
        ),
    );
    (goalAPI.fetchAll as jest.Mock).mockImplementation(
      ({ currentMonth }: { currentMonth: number }) =>
        new Promise((res) =>
          goalDeferreds.push({ month: currentMonth, resolve: res }),
        ),
    );

    const budgetReq = store.dispatch(
      fetchBudgets({
        currentMonth: CURRENT.month,
        currentYear: CURRENT.year,
      }) as any,
    );
    const goalPrevReq = store.dispatch(
      fetchGoals({
        currentMonth: PREV.month,
        currentYear: PREV.year,
      }) as any,
    );
    const goalCurrentReq = store.dispatch(
      fetchGoals({
        currentMonth: CURRENT.month,
        currentYear: CURRENT.year,
      }) as any,
    );
    const budgetPrevReq = store.dispatch(
      fetchBudgets({
        currentMonth: PREV.month,
        currentYear: PREV.year,
      }) as any,
    );

    // Resolve in an order that would corrupt state without the guard:
    // - current budgets resolve after prev budgets (stale current must be ignored)
    // - prev goals resolve after current goals (stale prev must be ignored)
    budgetDeferreds
      .find((d) => d.month === PREV.month)!
      .resolve(budgetResponse(PREV));
    await budgetPrevReq;
    budgetDeferreds
      .find((d) => d.month === CURRENT.month)!
      .resolve(budgetResponse(CURRENT));
    await budgetReq;

    goalDeferreds
      .find((d) => d.month === CURRENT.month)!
      .resolve(goalResponse(CURRENT));
    await goalCurrentReq;
    goalDeferreds
      .find((d) => d.month === PREV.month)!
      .resolve(goalResponse(PREV));
    await goalPrevReq;

    const state = store.getState() as any;
    // For budgets, the last request dispatched was PREV → prev data wins and
    // the stale CURRENT response (resolved later) must be ignored.
    expect(state.budget.budgets).toHaveLength(1);
    expect(state.budget.budgets[0].id).toBe("b-prev-dining");
    expect(
      state.budget.budgets.some((b: any) => b.id.startsWith("b-current-")),
    ).toBe(false);

    // For goals, the last request dispatched was CURRENT → current data wins
    // and the stale PREV response (resolved later) must be ignored.
    expect(state.goal.goals).toHaveLength(1);
    expect(state.goal.goals.map((g: any) => g.id)).toEqual([
      "g-current-emergency",
    ]);
    expect(state.goal.goals.some((g: any) => g.id.startsWith("g-prev-"))).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------

describe("month navigation – edge cases", () => {
  it("displays an empty month (no transactions, budgets, or goals) correctly", async () => {
    const store = makeStore();
    store.dispatch(
      setMonthYear({ month: TWO_AGO.month, year: TWO_AGO.year }) as any,
    );
    await loadMonth(store, TWO_AGO.month, TWO_AGO.year);

    const state = store.getState() as any;
    expect(state.transaction.monthSummary.monthlyIncome).toBe(0);
    expect(state.transaction.monthSummary.totalAmount).toBe(0);
    expect(state.transaction.transactions).toHaveLength(0);
    expect(state.budget.budgets).toHaveLength(0);
    expect(state.goal.goals).toHaveLength(0);
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

    const state = store.getState() as any;
    expect(state.transaction.transactions).toHaveLength(0);
    expect(state.budget.budgets).toHaveLength(0);
    expect(state.goal.goals).toHaveLength(0);
    expect(state.transaction.monthSummary.monthlyIncome).toBe(0);
  });
});
