/**
 * Transaction slice – reducer-level unit tests.
 *
 * The transaction slice owns ONLY transaction data. Financial aggregates
 * (monthly income, totals, percentages, …) live in the financialSummary slice,
 * so no aggregate fields should ever appear in transaction state.
 */

import transactionReducer, {
  TransactionState,
  fetchTransaction,
  fetchMoreTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/store/slices/transactionSlice";

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
  error: null,
  filter: { category: null, dateRange: { start: null, end: null } },
  isAdding: false,
  isEditing: false,
  editingTransaction: null,
  isDeleting: false,
  deleteError: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  },
  isLoadingMore: false,
};

/** Factory for a minimal transaction object used in tests. */
const makeTx = (overrides: Record<string, any> = {}) => ({
  id: "tx-1",
  name: "Coffee",
  month: 1,
  year: 2026,
  category: "Food",
  amount: 5.5,
  date: "2026-02-01T00:00:00.000Z",
  type: "EXPENSE",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Domain boundary: transaction state must not own aggregates
// ---------------------------------------------------------------------------

describe("transactionSlice – domain boundary", () => {
  it("does not expose aggregate state fields", () => {
    const state = transactionReducer(initialState, { type: "noop" });
    expect(state).not.toHaveProperty("monthSummary");
    expect(state).not.toHaveProperty("summary");
    expect(state).not.toHaveProperty("totalIncome");
    expect(state).not.toHaveProperty("totalExpense");
    expect(state).not.toHaveProperty("balance");
    expect(state).not.toHaveProperty("isFetchingSummary");
  });
});

// ---------------------------------------------------------------------------
// fetchTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – fetchTransaction", () => {
  it("1. sets isLoading=true on pending", () => {
    const action = { type: fetchTransaction.pending.type };
    const state = transactionReducer(initialState, action);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("2. stores transactions and pagination on fulfilled", () => {
    const payload = {
      transaction: [makeTx()],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalCount: 15,
        hasNextPage: true,
        hasPrevPage: false,
      },
    };
    const action = { type: fetchTransaction.fulfilled.type, payload };
    const state = transactionReducer(initialState, action);

    expect(state.isLoading).toBe(false);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].name).toBe("Coffee");
    expect(state.pagination.totalCount).toBe(15);
    expect(state.pagination.hasNextPage).toBe(true);
  });

  it("3. sets error on rejected", () => {
    const action = {
      type: fetchTransaction.rejected.type,
      payload: "Network error",
    };
    const state = transactionReducer(initialState, action);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Network error");
  });

  it("4. clears previous error on new pending", () => {
    const errorState = { ...initialState, error: "old error" };
    const action = { type: fetchTransaction.pending.type };
    const state = transactionReducer(errorState, action);
    expect(state.error).toBeNull();
  });

  it("5. replaces (not appends) transactions on fulfilled", () => {
    const stateWithExisting = {
      ...initialState,
      transactions: [makeTx({ id: "old-1" })] as any[],
    };
    const payload = {
      transaction: [makeTx({ id: "new-1" })],
      pagination: initialState.pagination,
    };
    const action = { type: fetchTransaction.fulfilled.type, payload };
    const state = transactionReducer(stateWithExisting, action);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].id).toBe("new-1");
  });

  it("6. ignores stale responses (latest-request-wins)", () => {
    const stateWith = {
      ...initialState,
      transactions: [makeTx({ id: "latest" })] as any[],
      latestRequestId: "request-2",
    };
    const stalePayload = {
      transaction: [makeTx({ id: "stale" })],
      pagination: initialState.pagination,
    };
    const action = {
      type: fetchTransaction.fulfilled.type,
      payload: stalePayload,
      meta: { requestId: "request-1" },
    } as any;
    const state = transactionReducer(stateWith, action);
    expect(state.transactions[0].id).toBe("latest");
  });
});

// ---------------------------------------------------------------------------
// fetchMoreTransactions (infinite scroll)
// ---------------------------------------------------------------------------

describe("transactionSlice – fetchMoreTransactions", () => {
  it("7. sets isLoadingMore=true on pending", () => {
    const action = { type: fetchMoreTransactions.pending.type };
    const state = transactionReducer(initialState, action);
    expect(state.isLoadingMore).toBe(true);
  });

  it("8. appends transactions on fulfilled", () => {
    const stateWith = {
      ...initialState,
      transactions: [makeTx({ id: "a" })] as any[],
    };
    const payload = {
      transaction: [makeTx({ id: "b" })],
      pagination: {
        currentPage: 2,
        totalPages: 3,
        totalCount: 25,
        hasNextPage: true,
        hasPrevPage: true,
      },
    };
    const action = { type: fetchMoreTransactions.fulfilled.type, payload };
    const state = transactionReducer(stateWith, action);
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions[1].id).toBe("b");
    expect(state.pagination.currentPage).toBe(2);
  });

  it("9. sets error on rejected", () => {
    const action = {
      type: fetchMoreTransactions.rejected.type,
      payload: "timeout",
    };
    const state = transactionReducer(initialState, action);
    expect(state.isLoadingMore).toBe(false);
    expect(state.error).toBe("timeout");
  });

  it("10. handles empty page gracefully", () => {
    const stateWith = {
      ...initialState,
      transactions: [makeTx({ id: "a" })] as any[],
    };
    const payload = {
      transaction: [],
      pagination: {
        currentPage: 2,
        totalPages: 2,
        totalCount: 1,
        hasNextPage: false,
        hasPrevPage: true,
      },
    };
    const action = { type: fetchMoreTransactions.fulfilled.type, payload };
    const state = transactionReducer(stateWith, action);
    expect(state.transactions).toHaveLength(1);
    expect(state.pagination.hasNextPage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – createTransaction", () => {
  it("11. sets isAdding=true on pending", () => {
    const action = { type: createTransaction.pending.type };
    const state = transactionReducer(initialState, action);
    expect(state.isAdding).toBe(true);
    expect(state.error).toBeNull();
  });

  it("12. pushes the created transaction on fulfilled", () => {
    const tx = makeTx({ id: "new-tx" });
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = transactionReducer(initialState, action);
    expect(state.isAdding).toBe(false);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].id).toBe("new-tx");
  });

  it("13. does not touch aggregate state on fulfilled", () => {
    const tx = makeTx({ amount: 25, type: "EXPENSE" });
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = transactionReducer(initialState, action);
    // Summary recomputation belongs to the financial summary domain, refreshed
    // via fetchFinancialSummary after a successful mutation.
    expect(state).not.toHaveProperty("monthSummary");
    expect(state).not.toHaveProperty("summary");
  });

  it("14. sets error on rejected", () => {
    const action = {
      type: createTransaction.rejected.type,
      payload: "server down",
    };
    const state = transactionReducer(initialState, action);
    expect(state.isAdding).toBe(false);
    expect(state.error).toBe("server down");
  });
});

// ---------------------------------------------------------------------------
// deleteTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – deleteTransaction", () => {
  const stateWithTx: TransactionState = {
    ...initialState,
    transactions: [
      makeTx({ id: "tx-1", amount: 30, type: "EXPENSE" }),
    ] as any[],
  };

  it("15. sets isDeleting=true on pending", () => {
    const action = { type: deleteTransaction.pending.type };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isDeleting).toBe(true);
    expect(state.deleteError).toBeNull();
  });

  it("16. removes transaction from state on fulfilled", () => {
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { deletedTransactionId: "tx-1" } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isDeleting).toBe(false);
    expect(state.transactions).toHaveLength(0);
  });

  it("17. no-ops if deletedTransactionId is missing from payload", () => {
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: {} },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.transactions).toHaveLength(1);
  });

  it("18. sets deleteError on rejected", () => {
    const action = {
      type: deleteTransaction.rejected.type,
      payload: "not found",
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isDeleting).toBe(false);
    expect(state.deleteError).toBe("not found");
  });
});

// ---------------------------------------------------------------------------
// updateTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – updateTransaction", () => {
  const stateWithTx: TransactionState = {
    ...initialState,
    transactions: [
      makeTx({ id: "tx-1", amount: 20, name: "Old Name", type: "EXPENSE" }),
    ] as any[],
  };

  it("19. sets isEditing=true on pending", () => {
    const action = { type: updateTransaction.pending.type };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isEditing).toBe(true);
    expect(state.error).toBeNull();
  });

  it("20. replaces matching transaction on fulfilled", () => {
    const updated = makeTx({ id: "tx-1", amount: 35, name: "New Name" });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isEditing).toBe(false);
    expect(state.transactions[0].name).toBe("New Name");
    expect(state.transactions[0].amount).toBe(35);
  });

  it("21. does not touch aggregate state on fulfilled", () => {
    const updated = makeTx({ id: "tx-1", amount: 35, type: "EXPENSE" });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state).not.toHaveProperty("monthSummary");
    expect(state).not.toHaveProperty("summary");
  });

  it("22. sets error on rejected", () => {
    const action = {
      type: updateTransaction.rejected.type,
      payload: "forbidden",
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isEditing).toBe(false);
    expect(state.error).toBe("forbidden");
  });

  it("23. no-ops if updated transaction id is not in state", () => {
    const updated = makeTx({ id: "unknown-id", amount: 999 });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.transactions[0].id).toBe("tx-1");
    expect(state.transactions[0].amount).toBe(20);
  });
});



