import {
  useDispatch,
  useSelector,
  TypedUseSelectorHook,
  shallowEqual,
} from "react-redux";
import type { RootState, AppDispatch } from "../store";

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

// Custom hooks for transaction state selections
export const useTransactions = () => {
  return useAppSelector((state) => state.transaction.transactions);
};

export const useTransactionStatus = () => {
  return useAppSelector(
    (state) => ({
      isAdding: state.transaction.isAdding,
      isEditing: state.transaction.isEditing,
      isDeleting: state.transaction.isDeleting,
      isLoading: state.transaction.isLoading,
      isLoadingMore: state.transaction.isLoadingMore,
      error: state.transaction.error,
    }),
    shallowEqual,
  );
};

export const useTransactionPagination = () => {
  return useAppSelector((state) => state.transaction.pagination);
};

// Custom hooks for financial summary state selections
export const useFinancialSummary = () => {
  return useAppSelector((state) => state.financialSummary.data);
};

export const useFinancialSummaryStatus = () => {
  return useAppSelector(
    (state) => ({
      isLoading: state.financialSummary.isLoading,
      error: state.financialSummary.error,
    }),
    shallowEqual,
  );
};

// Custom hooks for budget state selections
export const useBudgets = () => {
  return useAppSelector((state) => state.budget.budgets);
};

export const useBudgetStatus = () => {
  return useAppSelector(
    (state) => ({
      isLoading: state.budget.loading,
      error: state.budget.error,
    }),
    shallowEqual,
  );
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
