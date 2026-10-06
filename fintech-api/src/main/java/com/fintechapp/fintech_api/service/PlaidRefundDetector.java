package com.fintechapp.fintech_api.service;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

/** Classifies expense credits from explicit Plaid evidence, never amount/date matching. */
public final class PlaidRefundDetector {
    private static final Pattern REFUND = Pattern.compile("\\bREFUND\\b", Pattern.CASE_INSENSITIVE);
    private static final Set<String> EXPENSE_CATEGORIES = Set.of(
            "BANK_FEES", "ENTERTAINMENT", "FOOD_AND_DRINK", "GENERAL_MERCHANDISE",
            "GENERAL_SERVICES", "HOME_IMPROVEMENT", "MEDICAL", "PERSONAL_CARE",
            "RENT_AND_UTILITIES", "TRANSPORTATION", "TRAVEL");

    private PlaidRefundDetector() {}

    public static boolean isRefund(PlaidTransaction tx) {
        if (tx.amount() >= 0 || tx.transfer()) return false;
        // The institution's explicit merchant-credit code is the strongest evidence.
        if ("refund".equalsIgnoreCase(tx.transactionCode())) return true;
        String detailed = normalized(tx.plaidPfcDetailed());
        String category = normalized(tx.category());
        if (Set.of("TRANSFER_IN_REFUND", "TRANSFER_REFUND").contains(detailed)) return true;
        // Payroll, deposits and account transfers must never be inferred as refunds.
        if (hasIncomeEvidence(tx)) return false;
        // A negative amount explicitly categorized as a purchase is an expense credit.
        if (EXPENSE_CATEGORIES.stream().anyMatch(c -> category.equals(c) || detailed.startsWith(c + "_"))) return true;
        // Retain the existing literal REFUND evidence used to exclude transfer candidates.
        return REFUND.matcher(tx.name() == null ? "" : tx.name()).find()
                || REFUND.matcher(tx.category() == null ? "" : tx.category()).find();
    }

    static boolean hasIncomeEvidence(PlaidTransaction tx) {
        String detailed = normalized(tx.plaidPfcDetailed());
        return detailed.startsWith("INCOME_") || normalized(tx.category()).startsWith("INCOME")
                || detailed.equals("TRANSFER_IN_DEPOSIT") || detailed.equals("TRANSFER_IN_PAYROLL")
                || detailed.equals("TRANSFER_IN_ACCOUNT_TRANSFER");
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
