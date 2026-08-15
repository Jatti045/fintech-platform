/**
 * Financial summary slice – reducer-level unit tests.
 *
 * This slice owns month-scoped financial aggregates and is fully independent of
 * the transaction slice: fetching transactions must never update summary state
 * and vice versa.
 */

import financialSummaryReducer, {
  fetchFinancialSummary,
  clearFinancialSummary,
  type FinancialSummaryState,
} from "@/store/slices/financialSummarySlice";

const initialState: FinancialSummaryState = {
  data: null,
  isLoading: false,
  error: null,
  latestRequestId: null,
};

const summaryPayload = {
  totalAmount: 200,
  monthlyIncome: 4000,
  expectedIncome: 4000,
  actualIncome: 0,
  netSpent: 200,
  netRemaining: 3800,
  spentPercentageOfIncome: 5,
  goalAllocationAmount: 0,
};

describe("financialSummarySlice – fetchFinancialSummary", () => {
  it("sets isLoading=true on pending", () => {
    const action = { type: fetchFinancialSummary.pending.type };
    const state = financialSummaryReducer(initialState, action);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("stores the summary data on fulfilled", () => {
    const action = {
      type: fetchFinancialSummary.fulfilled.type,
      payload: summaryPayload,
    };
    const state = financialSummaryReducer(initialState, action);
    expect(state.isLoading).toBe(false);
    expect(state.data).toEqual(summaryPayload);
  });

  it("sets error on rejected", () => {
    const action = {
      type: fetchFinancialSummary.rejected.type,
      payload: "Network error",
    };
    const state = financialSummaryReducer(initialState, action);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Network error");
  });

  it("ignores stale responses (latest-request-wins)", () => {
    const stateWith = {
      ...initialState,
      data: summaryPayload,
      latestRequestId: "request-2",
    };
    const action = {
      type: fetchFinancialSummary.fulfilled.type,
      payload: { ...summaryPayload, monthlyIncome: 999 },
      meta: { requestId: "request-1" },
    } as any;
    const state = financialSummaryReducer(stateWith, action);
    expect(state.data?.monthlyIncome).toBe(4000);
  });

  it("clearFinancialSummary resets to null data", () => {
    const stateWithData = { ...initialState, data: summaryPayload };
    const state = financialSummaryReducer(
      stateWithData,
      clearFinancialSummary(),
    );
    expect(state.data).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe("financialSummarySlice – domain boundary", () => {
  it("does not own transaction list state", () => {
    const state = financialSummaryReducer(initialState, { type: "noop" });
    expect(state).not.toHaveProperty("transactions");
    expect(state).not.toHaveProperty("pagination");
  });
});
