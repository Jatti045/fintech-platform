package com.fintechapp.fintech_api.service;

import java.util.Locale;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import tools.jackson.databind.JsonNode;

/** Explicit candidate policy. Categories describe intent, never ownership or a pair. */
public final class PlaidTransferDetector {
    private static final java.util.regex.Pattern NON_TRANSFER_NAME = java.util.regex.Pattern.compile(
            "\\b(?:PAYROLL|SALARY|REFUND|REIMBURSEMENT|REIMBURSE|ATM|VENMO|PAYPAL|CASH APP|CASH WITHDRAWAL)\\b",
            java.util.regex.Pattern.CASE_INSENSITIVE);

    private PlaidTransferDetector() {}

    /** A raw single leg cannot establish an internal transfer. */
    public static boolean isTransfer(JsonNode transactionNode) {
        return false;
    }

    public static boolean isCandidate(Transaction transaction) {
        if (transaction.isExpenseCredit()) return false;
        // Contradictory, identifiable activity must not vanish even if Plaid's
        // transfer category is wrong. Names never positively establish a pair.
        if (transaction.getName() != null && NON_TRANSFER_NAME.matcher(transaction.getName()).find()) {
            return false;
        }
        String detailed = transaction.getPlaidPfcDetailed();
        if (detailed == null) {
            return false;
        }
        String code = detailed.trim().toUpperCase(Locale.ROOT);
        // Explicit PFC codes seen in the project's fixtures. Unknown codes fail closed.
        // Broad TRANSFER_IN/OUT, deposits, payroll, refunds, cash and P2P are not accepted.
        return switch (code) {
            case "TRANSFER_IN_ACCOUNT_TRANSFER" -> transaction.getType() == TransactionType.INCOME;
            case "TRANSFER_OUT_ACCOUNT_TRANSFER" -> transaction.getType() == TransactionType.EXPENSE;
            // Credit account payment credits can have the same detailed code as checking debits.
            case "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" -> transaction.getType() != null;
            default -> false;
        };
    }
}
