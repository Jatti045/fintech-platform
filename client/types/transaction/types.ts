// ─── Transaction Domain Types ───────────────────────────────────────────────

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

/** Full transaction shape as returned by the API / stored in Redux slices. */
export interface ITransaction {
  id?: string;
  name: string;
  month: number;
  year: number;
  category: string;
  amount: number;
  baseCurrency?: string | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  displayAmount?: number;
  displayCurrency?: string;
  date: string;
  type: TransactionType;
  /** True when the transaction moves money between the user's own accounts.
   *  Such transactions are shown in history but excluded from income/expense
   *  analytics. */
  isTransfer?: boolean;
  createdAt?: string;
  updatedAt?: string;
  budgetId?: string | null;
}

export interface ITransactionPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface ITransactionFilter {
  type?: TransactionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  budgetId?: string;
}

export interface ITransactionResponse<T> {
  success: boolean;
  message: string;
  data: {
    transaction: T;
    pagination?: ITransactionPagination;
    filters?: ITransactionFilter;
  };
}

export interface TransactionState {
  transactions: ITransaction[];
  isLoading: boolean;
  error: string | null;
  filter: {
    category: string | null;
    dateRange: { start: string | null; end: string | null };
  };
  isAdding: boolean;
  isEditing: boolean;
  editingTransaction: ITransaction | null;
  isDeleting: boolean;
  deleteError: string | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  isLoadingMore: boolean;
}

/** Minimal shape of a transaction as stored in Redux. */
export interface TransactionItem {
  id: string;
  name: string;
  amount: number | string;
  baseCurrency?: string | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  displayAmount?: number;
  displayCurrency?: string;
  date: string;
  category: string;
  budgetId?: string;
  type?: string;
  isTransfer?: boolean;
}

/** A single day-group for the SectionList. */
export interface GroupedSection {
  title: string;
  data: TransactionItem[];
  /** Aggregated spend for the day in dollars (computed with integer-cent math). */
  total: number;
}
