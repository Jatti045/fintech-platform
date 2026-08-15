import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import financialSummaryAPI from "@/api/financialSummary";
import type {
  FinancialSummaryState,
  IFinancialSummary,
} from "@/types/financialSummary/types";
import { logger } from "@/utils/logger";

export type { FinancialSummaryState, IFinancialSummary };

const initialState: FinancialSummaryState = {
  data: null,
  isLoading: false,
  error: null,
  latestRequestId: null,
};

export const fetchFinancialSummary = createAsyncThunk(
  "financialSummary/fetch",
  async (
    {
      currentMonth,
      currentYear,
    }: {
      currentMonth: number;
      currentYear: number;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await financialSummaryAPI.fetchSummary({
        currentMonth,
        currentYear,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.message || "Failed to load financial summary",
      );
    }
  },
);

const financialSummarySlice = createSlice({
  name: "financialSummary",
  initialState,
  reducers: {
    clearFinancialSummary(state) {
      state.data = null;
      state.error = null;
      state.isLoading = false;
      state.latestRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFinancialSummary.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        if (action.meta?.requestId) state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchFinancialSummary.fulfilled, (state, action) => {
        // Ignore stale responses: only the most recently started request may
        // write its month's summary into the store.
        if (
          action.meta?.requestId &&
          action.meta.requestId !== state.latestRequestId
        ) {
          return;
        }
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(fetchFinancialSummary.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearFinancialSummary } = financialSummarySlice.actions;
export const { reducer: financialSummaryReducer } = financialSummarySlice;

export default financialSummarySlice.reducer;
