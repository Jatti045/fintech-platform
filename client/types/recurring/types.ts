// ─── Recurring Payment Domain Types ─────────────────────────────────────────

/**
 * One detected upcoming bill.
 *
 * Everything here is an estimate derived from historical spending. The API and
 * UI both present these as predictions ("usually", "~"), never guarantees.
 */
export interface IRecurringPayment {
  /** Stable series key (normalized merchant) — used for dismissals. */
  seriesKey: string;
  /** Merchant name for display. */
  name: string;
  /** Estimated amount of the next occurrence. */
  expectedAmount: number;
  currency: string;
  /** WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY */
  cadence: string;
  /** Median interval in days between occurrences. */
  intervalDays: number;
  /** ISO-8601 UTC instant of the predicted next occurrence. */
  nextExpectedDate: string;
  /** ISO-8601 UTC instant of the most recent occurrence. */
  lastOccurredDate: string;
  occurrences: number;
  /** HIGH | MEDIUM — weak candidates never reach the client. */
  confidence: "HIGH" | "MEDIUM";
  /** Monthly bills only: typical day-of-month (1–31), else null. */
  usualDayOfMonth: number | null;
  /** Surfaced when the latest charge moved beyond rounding noise. */
  amountChange: { previousAmount: number; currentAmount: number } | null;
  /** Recent matching charges backing the prediction (for the detail view). */
  matchedTransactions: { id: string; date: string; amount: number }[];
}

/** Response envelope for GET /api/recurring-payments. */
export interface IRecurringPaymentsResponseData {
  recurringPayments: IRecurringPayment[];
}
