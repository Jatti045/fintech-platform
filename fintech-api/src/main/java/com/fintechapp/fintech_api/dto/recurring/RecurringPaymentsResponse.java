package com.fintechapp.fintech_api.dto.recurring;

import java.util.List;

/**
 * One detected recurring payment (an upcoming-bill candidate) produced by
 * {@code RecurringPaymentService}.
 *
 * <p>Everything here is an inference from historical spending and is presented
 * to the user as an estimate, never a guarantee. {@code confidence} states how
 * strong the evidence is; only HIGH and MEDIUM series are ever returned —
 * weaker candidates are dropped rather than surfaced.</p>
 */
public record RecurringPaymentsResponse(boolean success, String message, Data data) {

    public record Data(List<Item> recurringPayments) {
    }

    public record Item(
                    /** Stable series key (normalized merchant name) — used by the client for dismissals. */
                    String seriesKey,
                    /** Most frequent raw merchant name observed, for display. */
                    String name,
                    /** Estimated amount of the next occurrence (the most recent charge). */
                    double expectedAmount,
                    /** Currency of the stored amounts (the user's base currency). */
                    String currency,
                    /** {@code WEEKLY} | {@code BIWEEKLY} | {@code MONTHLY} | {@code QUARTERLY}. */
                    String cadence,
                    /** Median interval in days between occurrences. */
                    int intervalDays,
                    /** ISO-8601 UTC instant of the predicted next occurrence. */
                    String nextExpectedDate,
                    /** ISO-8601 UTC instant of the most recent occurrence. */
                    String lastOccurredDate,
                    /** How many collapsed occurrences the prediction rests on. */
                    int occurrences,
                    /** {@code HIGH} | {@code MEDIUM}. */
                    String confidence,
                    /**
                     * Monthly cadences only: the typical day-of-month (1-31) this bill
                     * lands on, e.g. 27 for "usually around the 27th". Null otherwise.
                     */
                    Integer usualDayOfMonth,
                    /**
                     * Non-null when the latest amount meaningfully differs from the
                     * established amount: the change is surfaced instead of silently
                     * absorbed.
                     */
                    AmountChange amountChange,
                    /** Recent matching transactions backing this series (oldest first, capped). */
                    List<MatchedTransaction> matchedTransactions) {

            public record AmountChange(double previousAmount, double currentAmount) {
            }

            public record MatchedTransaction(
                            String id,
                            String date,
                            double amount) {
            }
    }
}