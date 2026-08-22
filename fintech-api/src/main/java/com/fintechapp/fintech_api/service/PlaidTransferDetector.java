package com.fintechapp.fintech_api.service;

import tools.jackson.databind.JsonNode;

/**
 * Decides whether a raw Plaid transaction is an internal transfer that must be
 * excluded from income and expense calculations.
 *
 * <p><b>The only transfer rule.</b> A transaction is a transfer only when it
 * moves money between two accounts that both belong to the same user at the
 * same financial institution. Every other money movement is either income
 * (money in) or an expense (money out).</p>
 *
 * <p><b>Why this always returns {@code false} today.</b> Proving the transfer
 * rule requires knowing which Plaid account each transaction belongs to and
 * which financial institution (Plaid item) that account is part of. The
 * application's persisted model does not retain that information:</p>
 * <ul>
 *   <li>transactions do not store {@code account_id} nor a {@code plaid_item_id}
 *       (the column was intentionally removed from the schema);</li>
 *   <li>there is no account entity and no account-to-item mapping;</li>
 *   <li>Plaid's categories ({@code TRANSFER_IN}/{@code TRANSFER_OUT},
 *       {@code TRANSFER_ACCOUNT_TRANSFER}, {@code LOAN_PAYMENTS}, ...) describe
 *       the <em>category</em> of a movement, not the <em>ownership</em> of the
 *       accounts involved, and also cover Venmo/PayPal P2P payments, cash
 *       deposits, wire transfers and external loan payments — none of which are
 *       internal transfers.</li>
 * </ul>
 *
 * <p>Using those categories as evidence caused real external money movements
 * (P2P receipts, cash deposits, transfers between the user's accounts at
 * different banks) to be wrongly excluded from income/expense. Because account
 * ownership cannot be proven from the available data, the safe behavior is to
 * classify nothing as a transfer: money in is income, money out is an expense,
 * and no transaction is wrongly hidden from the user's financial totals.</p>
 *
 * <p><b>What information is missing to enable real detection:</b> persist each
 * transaction's {@code account_id} and its Plaid item, plus an
 * account-to-item mapping, so two legs can be proven to belong to the same
 * user's accounts at the same institution. Credit card payments can then be
 * recognized as internal transfers only when that ownership is established
 * (same user, same institution). Until then, a credit card payment is treated
 * as an expense, and no heuristic is invented to guess ownership.</p>
 */
public final class PlaidTransferDetector {

    private PlaidTransferDetector() {
    }

    /**
     * @param transactionNode the raw Plaid transaction object (unused — the
     *                        detector has no access to account ownership)
     * @return always {@code false}: the application cannot establish that a
     *         transaction moves money between two of the same user's accounts
     *         at the same financial institution from the data it persists, so
     *         every transaction is treated as income or expense.
     */
    public static boolean isTransfer(JsonNode transactionNode) {
        return false;
    }
}
