import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import goalAPI from "@/api/goal";
import type { GoalState, IGoal, IGoalData } from "@/types/goal/types";

const initialState: GoalState = {
  goals: [],
  loading: false,
  error: null,
  latestRequestId: null,
};

export const fetchGoals = createAsyncThunk(
  "goal/fetchGoals",
  async ({currentMonth, currentYear}: {currentMonth: number, currentYear: number}, { rejectWithValue }) => {
    try {
      const response = await goalAPI.fetchAll({
        currentMonth,
        currentYear
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch goals");
    }
  },
);

export const createGoal = createAsyncThunk(
  "goal/createGoal",
  async (goalData: IGoalData, { rejectWithValue }) => {
    try {
      const response = await goalAPI.create(goalData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create goal");
    }
  },
);

export const updateGoal = createAsyncThunk(
  "goal/updateGoal",
  async (
    { goalId, updates }: { goalId: string; updates: Partial<IGoalData> },
    { rejectWithValue },
  ) => {
    try {
      const response = await goalAPI.update(goalId, updates);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update goal");
    }
  },
);

export const allocateToGoal = createAsyncThunk(
  "goal/allocate",
  async (
    { goalId, amount }: { goalId: string; amount: number },
    { rejectWithValue },
  ) => {
    try {
      const response = await goalAPI.allocate(goalId, amount);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to allocate to goal");
    }
  },
);

export const deallocateFromGoal = createAsyncThunk(
  "goal/deallocate",
  async (
    { goalId, amount }: { goalId: string; amount: number },
    { rejectWithValue },
  ) => {
    try {
      const response = await goalAPI.deallocate(goalId, amount);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to deallocate from goal");
    }
  },
);

export const deleteGoal = createAsyncThunk(
  "goal/deleteGoal",
  async (goalId: string, { rejectWithValue }) => {
    try {
      const response = await goalAPI.delete(goalId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete goal");
    }
  },
);

const goalSlice = createSlice({
  name: "goal",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGoals.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        if (action.meta?.requestId) state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchGoals.fulfilled, (state, action) => {
        if (
          action.meta?.requestId &&
          action.meta.requestId !== state.latestRequestId
        ) {
          return;
        }
        state.loading = false;
        state.goals = action.payload || [];
      })
      .addCase(fetchGoals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createGoal.fulfilled, (state, action) => {
        state.loading = false;
        state.goals.unshift(action.payload);
      })
      .addCase(createGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGoal.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        state.goals = state.goals.map((g) =>
          g.id === updated.id ? updated : g,
        );
      })
      .addCase(updateGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(allocateToGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(allocateToGoal.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        state.goals = state.goals.map((g) =>
          g.id === updated.id ? updated : g,
        );
      })
      .addCase(allocateToGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deallocateFromGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deallocateFromGoal.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        state.goals = state.goals.map((g) =>
          g.id === updated.id ? updated : g,
        );
      })
      .addCase(deallocateFromGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteGoal.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = action.payload;
        state.goals = state.goals.filter((g) => g.id !== deletedId);
      })
      .addCase(deleteGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default goalSlice.reducer;
