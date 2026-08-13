import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import transactionAPI from "../../api/transaction";
import type { ITransaction } from "@/types/transaction/types";
import type { TransactionState } from "@/types/transaction/types";
import {
  getTransactionsCache,
  setTransactionsCache,
  appendTransactionToCache,
  removeTransactionFromCacheById,
  removeTransactionFromCacheByIdAcrossAllMonths,
  getGoalAllocationsTotalCache,
} from "../../utils/cache";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import { logger } from "@/utils/logger";

export type { TransactionState };

const round2 = (value: number) => Math.round(value * 100) / 100;

const withGoalAllocationFallback = async (
  payload: any,
  currentYear: number,
  currentMonth: number,
) => {
  const base = payload ?? {};
  const summary = base.summary ?? null;
  if (!summary) return base;

  const includesGoalAllocations = Boolean(summary.includesGoalAllocations);
  if (includesGoalAllocations) return base;

  const cachedGoalAllocations = await getGoalAllocationsTotalCache(
    currentYear,
    currentMonth,
  );
  if (!cachedGoalAllocations) return base;

  const totalAmount = round2(
    Number(summary.totalAmount || 0) + Number(cachedGoalAllocations || 0),
  );
  const monthlyIncome = Number(summary.monthlyIncome || 0);

  return {
    ...base,
    summary: {
      ...summary,
      totalAmount,
      netSpent: totalAmount,
      netRemaining: round2(monthlyIncome - totalAmount),
      spentPercentageOfIncome:
        monthlyIncome > 0 ? round2((totalAmount / monthlyIncome) * 100) : 0,
      goalAllocationAmount: Number(summary.goalAllocationAmount || 0),
      includesGoalAllocations: false,
    },
  };
};

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
  error: null,
  filter: {
    category: null,
    dateRange: { start: null, end: null },
  },
  totalIncome: 0,
  totalExpense: 0,
  balance: 0,
  isAdding: false,
  isEditing: false,
  editingTransaction: null,
  isDeleting: false,
  deleteError: null,
  isFetchingSummary: false,
  summary: {
    incomeByCategory: {},
    expenseByCategory: {},
    monthlyTrends: [],
    topExpenses: [],
    topIncomes: [],
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  },
  monthSummary: {
    totalAmount: 0,
    monthlyIncome: 0,
    netSpent: 0,
    netRemaining: 0,
    spentPercentageOfIncome: 0,
  },
  isLoadingMore: false,
  latestRequestId: null,
};

export const fetchTransaction = createAsyncThunk(
  "transactions/fetch",
  async (
    {
      searchQuery = "",
      currentMonth,
      currentYear,
      startDate = null,
      endDate = null,
      budgetId = null,
      minAmount = null,
      maxAmount = null,
      useCache = true,
      page = 1,
      limit = PAGINATION_LIMIT,
    }: {
      searchQuery: string;
      currentMonth: number;
      currentYear: number;
      startDate?: string | null;
      endDate?: string | null;
      budgetId?: string | null;
      minAmount?: number | null;
      maxAmount?: number | null;
      useCache?: boolean;
      page?: number;
      limit?: number;
    },
    { rejectWithValue },
  ) => {
    try {
      const hasServerFilters =
        Boolean(searchQuery?.trim()) ||
        Boolean(startDate) ||
        Boolean(endDate) ||
        Boolean(budgetId) ||
        minAmount != null ||
        maxAmount != null;
      const shouldCacheFirstPage = page === 1 && !hasServerFilters;

      // Disable cache when using pagination beyond first page
      if (page > 1 || !useCache) {
        const response = await transactionAPI.fetchAll({
          searchQuery,
          currentMonth,
          currentYear,
          startDate,
          endDate,
          budgetId,
          minAmount,
          maxAmount,
          page,
          limit,
        });

        // persist to cache only for page 1 (overwrite month cache)
        if (shouldCacheFirstPage) {
          try {
            const toStore = response.data?.transaction ?? response.data ?? [];
            await setTransactionsCache(currentYear, currentMonth, toStore);
          } catch (err) {
            logger.warn(
              "transactionSlice",
              "Failed to cache first transaction page",
              err,
            );
          }
        }

        return withGoalAllocationFallback(
          response.data,
          currentYear,
          currentMonth,
        );
      }

      // If allowed, return cached data immediately to avoid API call (page 1 only)
      if (useCache && page === 1) {
        try {
          const cached = await getTransactionsCache(currentYear, currentMonth);
          if (cached) {
            // Kick off background revalidation (don't await)
            (async () => {
              try {
                const fresh = await transactionAPI.fetchAll({
                  searchQuery: "",
                  currentMonth,
                  currentYear,
                  budgetId: null,
                  page: 1,
                  limit,
                });
                const toStore = fresh.data?.transaction ?? fresh.data ?? [];
                await setTransactionsCache(currentYear, currentMonth, toStore);
              } catch (err) {
                logger.warn(
                  "transactionSlice",
                  "Background revalidation failed",
                  err,
                );
              }
            })();
            // Return cached data with default pagination
            return {
              transaction: cached,
              pagination: {
                currentPage: 1,
                totalPages: 1,
                totalCount: cached.length,
                hasNextPage: false,
                hasPrevPage: false,
                limit: limit,
              },
            } as any;
          }
        } catch (e) {
          logger.warn(
            "transactionSlice",
            "Cache read failed, falling back to network",
            e,
          );
        }
      }

      // If we returned cached data above the caller won't know we revalidated;
      // ensure consumers can trigger a background revalidation by calling fetchTransaction with useCache = false.

      const response = await transactionAPI.fetchAll({
        searchQuery,
        currentMonth,
        currentYear,
        startDate,
        endDate,
        budgetId,
        minAmount,
        maxAmount,
        page,
        limit,
      });

      // persist to cache (overwrite month cache)
      if (shouldCacheFirstPage) {
        try {
          const toStore = response.data?.transaction ?? response.data ?? [];
          await setTransactionsCache(currentYear, currentMonth, toStore);
        } catch (err) {
          logger.warn(
            "transactionSlice",
            "Failed to persist transactions cache",
            err,
          );
        }
      }

      return withGoalAllocationFallback(
        response.data,
        currentYear,
        currentMonth,
      );
    } catch (error: any) {
      // On network failure try to return cached data
      try {
        const cached = await getTransactionsCache(currentYear, currentMonth);
        if (cached) return { transaction: cached } as any;
      } catch (err) {
        logger.warn("transactionSlice", "Fallback cache read failed", err);
      }
      return rejectWithValue(error.message || "Failed to fetch transactions");
    }
  },
);

// Fetch more transactions (for infinite scroll)
export const fetchMoreTransactions = createAsyncThunk(
  "transactions/fetchMore",
  async (
    {
      searchQuery = "",
      currentMonth,
      currentYear,
      startDate = null,
      endDate = null,
      budgetId = null,
      minAmount = null,
      maxAmount = null,
      page = 1,
      limit = PAGINATION_LIMIT,
    }: {
      searchQuery: string;
      currentMonth: number;
      currentYear: number;
      startDate?: string | null;
      endDate?: string | null;
      budgetId?: string | null;
      minAmount?: number | null;
      maxAmount?: number | null;
      page?: number;
      limit?: number;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await transactionAPI.fetchAll({
        searchQuery,
        currentMonth,
        currentYear,
        startDate,
        endDate,
        budgetId,
        minAmount,
        maxAmount,
        page,
        limit,
      });

      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.message || "Failed to fetch more transactions",
      );
    }
  },
);

export const createTransaction = createAsyncThunk(
  "transactions/create",
  async (transaction: ITransaction, { rejectWithValue, getState }) => {
    try {
      const response = await transactionAPI.create(transaction);

      // Update cache for the month the transaction belongs to
      try {
        const created = response.data?.transaction ?? response.data;
        await appendTransactionToCache(created);
      } catch (err) {
        logger.warn(
          "transactionSlice",
          "Failed to append created transaction to cache",
          err,
        );
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create transaction");
    }
  },
);

export const deleteTransaction = createAsyncThunk(
  "transactions/delete",
  async (transactionId: string, { rejectWithValue }) => {
    try {
      const response = await transactionAPI.delete(transactionId);
      // Try to update cache via helper (best-effort)
      try {
        const payload: any = response?.data ?? null;
        const deletedTx: any = payload?.transaction ?? null;
        if (deletedTx && deletedTx.date) {
          const d = new Date(deletedTx.date);
          await removeTransactionFromCacheById(
            transactionId,
            d.getFullYear(),
            d.getMonth(),
          );
        } else {
          // If server didn't return the deleted tx date, attempt to remove across all cached months
          await removeTransactionFromCacheByIdAcrossAllMonths(transactionId);
        }
      } catch (e) {
        logger.warn(
          "transactionSlice",
          "Failed to update cache after delete",
          e,
        );
      }
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete transaction");
    }
  },
);

export const updateTransaction = createAsyncThunk(
  "transactions/update",
  async (
    { id, updates }: { id: string; updates: Partial<ITransaction> },
    { rejectWithValue },
  ) => {
    try {
      logger.debug("transactionSlice", `Updating transaction ${id}`, updates);

      const response = await transactionAPI.update(id, updates);

      // update cache best-effort: overwrite in month cache if possible
      try {
        const updated = response.data?.transaction ?? response.data;
        if (updated && updated.id) {
          // Defensive: remove any stale copies across all months, then append to the correct month
          try {
            await removeTransactionFromCacheByIdAcrossAllMonths(updated.id);
          } catch (e) {
            logger.warn(
              "transactionSlice",
              "Failed cross-month cache invalidation",
              e,
            );
          }

          if (updated.date) {
            const d = new Date(updated.date);
            await appendTransactionToCache(updated);
          }
        }
      } catch (e) {
        logger.warn(
          "transactionSlice",
          "Failed to update cache after transaction update",
          e,
        );
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update transaction");
    }
  },
);

const transactionSlice = createSlice({
  name: "transaction",
  initialState,
  reducers: {
    addGoalAllocationSpent: (state, action: PayloadAction<number>) => {
      const amount = Math.max(0, Number(action.payload || 0));
      if (!amount) return;

      const nextTotal =
        Math.round((state.monthSummary.totalAmount + amount) * 100) / 100;
      state.monthSummary.totalAmount = nextTotal;

      const income = Number(state.monthSummary.monthlyIncome || 0);
      state.monthSummary.netSpent = nextTotal;
      state.monthSummary.netRemaining =
        Math.round((income - nextTotal) * 100) / 100;
      state.monthSummary.spentPercentageOfIncome =
        income > 0 ? Math.round((nextTotal / income) * 10000) / 100 : 0;
    },
    removeGoalAllocationSpent: (state, action: PayloadAction<number>) => {
      const amount = Math.max(0, Number(action.payload || 0));
      if (!amount) return;

      const nextTotal =
        Math.round(Math.max(0, state.monthSummary.totalAmount - amount) * 100) /
        100;
      state.monthSummary.totalAmount = nextTotal;

      const income = Number(state.monthSummary.monthlyIncome || 0);
      state.monthSummary.netSpent = nextTotal;
      state.monthSummary.netRemaining =
        Math.round((income - nextTotal) * 100) / 100;
      state.monthSummary.spentPercentageOfIncome =
        income > 0 ? Math.round((nextTotal / income) * 10000) / 100 : 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Transactions (initial load - replaces transactions)
      .addCase(fetchTransaction.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        // Latest-request-wins: remember the newest request so stale (older)
        // responses can be ignored in the fulfilled handler.
        if (action.meta?.requestId) state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchTransaction.fulfilled, (state, action) => {
        // Ignore stale responses: only the most recently started request may
        // write its month's data into the store. Prevents out-of-order/older
        // month responses from clobbering the currently selected month.
        if (action.meta?.requestId && action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.isLoading = false;
        state.transactions = action.payload.transaction;
        state.error = null;
        // Update pagination info
        if (action.payload.pagination) {
          state.pagination = {
            currentPage: action.payload.pagination.currentPage,
            totalPages: action.payload.pagination.totalPages,
            totalCount: action.payload.pagination.totalCount,
            hasNextPage: action.payload.pagination.hasNextPage,
            hasPrevPage: action.payload.pagination.hasPrevPage,
          };
        }
        // Update month summary (total amount for all transactions in filter)
        if (action.payload.summary) {
          state.monthSummary = {
            totalAmount: action.payload.summary.totalAmount || 0,
            monthlyIncome: action.payload.summary.monthlyIncome || 0,
            expectedIncome: action.payload.summary.expectedIncome || 0,
            actualIncome: action.payload.summary.actualIncome || 0,
            netSpent: action.payload.summary.netSpent || 0,
            netRemaining: action.payload.summary.netRemaining || 0,
            spentPercentageOfIncome:
              action.payload.summary.spentPercentageOfIncome || 0,
          };
        }
      })
      .addCase(fetchTransaction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Fetch More Transactions (infinite scroll - appends transactions)
      .addCase(fetchMoreTransactions.pending, (state) => {
        state.isLoadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreTransactions.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        // Append new transactions to existing ones
        const newTransactions = action.payload.transaction || [];
        state.transactions = [...state.transactions, ...newTransactions];
        state.error = null;
        // Update pagination info
        if (action.payload.pagination) {
          state.pagination = {
            currentPage: action.payload.pagination.currentPage,
            totalPages: action.payload.pagination.totalPages,
            totalCount: action.payload.pagination.totalCount,
            hasNextPage: action.payload.pagination.hasNextPage,
            hasPrevPage: action.payload.pagination.hasPrevPage,
          };
        }
      })
      .addCase(fetchMoreTransactions.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.error = action.payload as string;
      })

      // Create Transaction
      .addCase(createTransaction.pending, (state) => {
        state.isAdding = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        logger.debug("transactionSlice", "Transaction created", action.payload);

        state.isAdding = false;
        state.error = null;
        const created = action.payload.data?.transaction ?? action.payload.data;
        state.transactions.push(created);

        // Optimistically update monthSummary when an EXPENSE is added
        if (
          created &&
          (created.type ?? "EXPENSE").toUpperCase() === "EXPENSE"
        ) {
          state.monthSummary.totalAmount =
            Math.round(
              (state.monthSummary.totalAmount + Number(created.amount || 0)) *
                100,
            ) / 100;
        }
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.isAdding = false;
        state.error = action.payload as string;
      })
      // Delete Transaction
      .addCase(deleteTransaction.pending, (state) => {
        state.isDeleting = true;
        state.deleteError = null;
      })
      .addCase(deleteTransaction.fulfilled, (state, action: any) => {
        state.isDeleting = false;
        // API returns { data: { deletedTransactionId: id, ... } }
        const payload = action.payload ?? null;
        const deletedId = payload?.data?.deletedTransactionId ?? null;
        if (deletedId) {
          // Find the transaction before removing so we can adjust the summary
          const deletedTx = state.transactions.find((t) => t.id === deletedId);
          if (
            deletedTx &&
            (deletedTx.type ?? "EXPENSE").toUpperCase() === "EXPENSE"
          ) {
            const amt = parseFloat(Number(deletedTx.amount || 0).toFixed(2));
            state.monthSummary.totalAmount = parseFloat(
              Math.max(0, state.monthSummary.totalAmount - amt).toFixed(2),
            );
          }
          state.transactions = state.transactions.filter(
            (t) => t.id !== deletedId,
          );
        }
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.isDeleting = false;
        state.deleteError = action.payload as string;
      });

    builder
      .addCase(updateTransaction.pending, (state) => {
        state.isEditing = true;
        state.error = null;
      })
      .addCase(updateTransaction.fulfilled, (state, action: any) => {
        state.isEditing = false;
        state.error = null;
        const updated = action.payload.data?.transaction ?? action.payload.data;
        if (updated && updated.id) {
          // Adjust monthSummary if the amount changed on an EXPENSE transaction
          const oldTx = state.transactions.find((t) => t.id === updated.id);
          if (oldTx && (oldTx.type ?? "EXPENSE").toUpperCase() === "EXPENSE") {
            const oldAmt = Number(oldTx.amount || 0);
            const newAmt = Number(updated.amount || 0);
            if (oldAmt !== newAmt) {
              state.monthSummary.totalAmount =
                Math.round(
                  Math.max(
                    0,
                    state.monthSummary.totalAmount - oldAmt + newAmt,
                  ) * 100,
                ) / 100;
            }
          }
          state.transactions = state.transactions.map((t) =>
            t.id === updated.id ? updated : t,
          );
        }
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.isEditing = false;
        state.error = action.payload as string;
      });
  },
});

// Optional action: replace transactions array directly (useful after forced re-fetch)
export const { reducer: transactionReducer } = transactionSlice;
export const { addGoalAllocationSpent, removeGoalAllocationSpent } =
  transactionSlice.actions;
export const replaceTransactions = (arr: ITransaction[]) => ({
  type: "transaction/replace",
  payload: arr,
});

export default transactionSlice.reducer;
