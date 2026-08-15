import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import transactionAPI from "../../api/transaction";
import type { ITransaction } from "@/types/transaction/types";
import type { TransactionState } from "@/types/transaction/types";
import {
  getTransactionsCache,
  setTransactionsCache,
  appendTransactionToCache,
  removeTransactionFromCacheById,
  removeTransactionFromCacheByIdAcrossAllMonths,
} from "../../utils/cache";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import { logger } from "@/utils/logger";

export type { TransactionState };

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
  error: null,
  filter: {
    category: null,
    dateRange: { start: null, end: null },
  },
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

        return response.data;
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

      return response.data;
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
  async (transaction: ITransaction, { rejectWithValue }) => {
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
  reducers: {},
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
          state.transactions = state.transactions.filter(
            (t) => t.id !== deletedId,
          );
        }
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.isDeleting = false;
        state.deleteError = action.payload as string;
      })

      // Update Transaction
      .addCase(updateTransaction.pending, (state) => {
        state.isEditing = true;
        state.error = null;
      })
      .addCase(updateTransaction.fulfilled, (state, action: any) => {
        state.isEditing = false;
        state.error = null;
        const updated = action.payload.data?.transaction ?? action.payload.data;
        if (updated && updated.id) {
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

export const { reducer: transactionReducer } = transactionSlice;

export default transactionSlice.reducer;
