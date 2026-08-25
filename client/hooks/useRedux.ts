import {
  useDispatch,
  useSelector,
  TypedUseSelectorHook,
  shallowEqual,
} from "react-redux";
import type { RootState, AppDispatch } from "../store";
import {
  defaultTransactionArgs,
  useGetBudgetsQuery,
  useGetFinancialSummaryQuery,
  useGetTransactionsQuery,
} from "../store/api/apiSlice";

// Used instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Selector hooks.
 *
 * Hooks that compose multiple fields into an object literal MUST pass
 * `shallowEqual` as the equality function — otherwise the fresh object
 * returned on every store change is never reference-equal and the component
 * re-renders on every dispatch, even for unrelated slices. Hooks that return
 * state references directly (arrays/slices/primitives) keep the default
 * strict equality, which is already stable between relevant changes.
 */

// Custom hooks for common user state selections
export const useAuth = () => {
  return useAppSelector(
    (state) => ({
      user: state.user.user,
      token: state.user.token,
      isAuthenticated: state.user.isAuthenticated,
      isLoading: state.user.isLoading,
      error: state.user.error,
      loginError: state.user.loginError,
      signupError: state.user.signupError,
    }),
    shallowEqual,
  );
};

export const useUser = () => {
  return useAppSelector((state) => state.user.user);
};

export const useAuthStatus = () => {
  return useAppSelector(
    (state) => ({
      isAuthenticated: state.user.isAuthenticated,
      isLoading: state.user.isLoading,
    }),
    shallowEqual,
  );
};

const NO_TRANSACTIONS: never[] = [];
const NO_BUDGETS: never[] = [];

/** Extracts a human-readable message from an RTK Query custom error. */
const errorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === "object" && "error" in (error as any)) {
    return String((error as any).error);
  }
  return null;
};

/**
 * Transactions for the selected calendar month (unfiltered page 1).
 *
 * Multiple components subscribing through this hook share one request and
 * one cache entry — this replaces the old competing layout/screen fetches.
 */
export const useTransactions = () => {
  const { month, year } = useCalendar();
  const { data } = useGetTransactionsQuery(defaultTransactionArgs(month, year));
  return data?.transaction ?? NO_TRANSACTIONS;
};

export const useTransactionPagination = () => {
  const { month, year } = useCalendar();
  const { data } = useGetTransactionsQuery(defaultTransactionArgs(month, year));
  return (
    data?.pagination ?? {
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      hasNextPage: false,
      hasPrevPage: false,
    }
  );
};

// Custom hooks for financial summary state selections
export const useFinancialSummary = () => {
  const { month, year } = useCalendar();
  const { data } = useGetFinancialSummaryQuery({
    currentMonth: month,
    currentYear: year,
  });
  return data ?? null;
};

export const useFinancialSummaryStatus = () => {
  const { month, year } = useCalendar();
  const { isFetching, error } = useGetFinancialSummaryQuery({
    currentMonth: month,
    currentYear: year,
  });
  return { isLoading: isFetching, error: errorMessage(error) };
};

// Custom hooks for budget state selections
export const useBudgets = () => {
  const { month, year } = useCalendar();
  const { data } = useGetBudgetsQuery({
    currentMonth: month,
    currentYear: year,
  });
  return data ?? NO_BUDGETS;
};

export const useBudgetStatus = () => {
  const { month, year } = useCalendar();
  const { isFetching, error } = useGetBudgetsQuery({
    currentMonth: month,
    currentYear: year,
  });
  return { isLoading: isFetching, error: errorMessage(error) };
};

export const useCalendar = () => {
  return useAppSelector(
    (state) => ({
      month: state.calendar.month,
      year: state.calendar.year,
    }),
    shallowEqual,
  );
};

/**
 * In-flight flags for transaction mutations (create/update/delete), read
 * from the RTK Query mutation entries so loader overlays can render while
 * any screen/modal has an operation in progress.
 *
 * RTK Query keys `state.api.mutations` by requestId (each entry carries its
 * own `endpointName`), so the check scans entries for a matching endpoint
 * rather than indexing by endpoint name.
 */
const isMutationPending = (
  state: RootState,
  endpointName: string,
): boolean => {
  const mutations = state.api.mutations as Record<string, any> | undefined;
  if (!mutations) return false;
  for (const key of Object.keys(mutations)) {
    const entry = mutations[key];
    if (entry?.endpointName === endpointName && entry.status === "pending") {
      return true;
    }
  }
  return false;
};

export const useTransactionMutationStatus = () => {
  return useAppSelector(
    (state) => ({
      isAdding: isMutationPending(state, "createTransaction"),
      isEditing: isMutationPending(state, "updateTransaction"),
      isDeleting: isMutationPending(state, "deleteTransaction"),
    }),
    shallowEqual,
  );
};

// Custom hook for theme state selection (returns the slice reference —
// stable unless the theme itself changes, so no custom equality needed)
export const useTheme = () => {
  return useAppSelector((state) => state.theme);
};

// Custom hook for notification preference state selection
export const useNotificationPreferences = () => {
  return useAppSelector(
    (state) => ({
      purchaseRemindersEnabled: state.notifications.purchaseRemindersEnabled,
      timezone: state.notifications.timezone,
      loaded: state.notifications.loaded,
      permissionStatus: state.notifications.permissionStatus,
    }),
    shallowEqual,
  );
};
