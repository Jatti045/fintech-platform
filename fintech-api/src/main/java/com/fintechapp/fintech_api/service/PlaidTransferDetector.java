package com.fintechapp.fintech_api.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.util.StringUtils;

import tools.jackson.databind.JsonNode;

/**
 * Classifies whether a raw Plaid transaction represents a transfer of money
 * between accounts — movement of existing money rather than income or an
 * expense.
 *
 * <p>Detection is driven exclusively by Plaid's <em>structured categorization
 * fields</em>, never by free-text merchant/name matching:
 * <ul>
 *   <li>modern {@code personal_finance_category}: the primary/detailed/
 *       subcategory codes {@code TRANSFER_IN} and {@code TRANSFER_OUT};</li>
 *   <li>legacy {@code category} array whose value is {@code Transfer}.</li>
 * </ul>
 *
 * <p>Note: Plaid's {@code TRANSFER_IN}/{@code TRANSFER_OUT} categories also
 * cover transfers that are not strictly internal (e.g. peer-to-peer apps,
 * wire transfers). With only category data persisted, this application treats
 * every structured transfer category the same way: excluded from income and
 * expense analytics, but still stored and shown in the transaction history.</p>
 */
public final class PlaidTransferDetector {

    private static final Set<String> TRANSFER_CATEGORY_CODES = Set.of("TRANSFER_IN", "TRANSFER_OUT");
    private static final String LEGACY_TRANSFER_CATEGORY = "Transfer";

    private PlaidTransferDetector() {
    }

    /**
     * @param transactionNode the raw Plaid transaction object
     * @return {@code true} when the transaction's Plaid categorization marks it
     *         as a transfer between accounts
     */
    public static boolean isTransfer(JsonNode transactionNode) {
        if (transactionNode == null) {
            return false;
        }
        return matchesPersonalFinanceCategory(transactionNode) || matchesLegacyCategory(transactionNode);
    }

    private static boolean matchesPersonalFinanceCategory(JsonNode transactionNode) {
        JsonNode personalFinance = transactionNode.get("personal_finance_category");
        if (personalFinance == null) {
            return false;
        }
        // Plaid reports the same code at several hierarchy levels; any match wins.
        for (String key : List.of("primary", "detailed", "subcategory")) {
            String value = personalFinance.path(key).asText(null);
            if (StringUtils.hasText(value) && TRANSFER_CATEGORY_CODES.contains(normalize(value))) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesLegacyCategory(JsonNode transactionNode) {
        JsonNode legacy = transactionNode.get("category");
        if (legacy == null || !legacy.isArray()) {
            return false;
        }
        for (JsonNode entry : legacy) {
            String value = entry.asText(null);
            if (StringUtils.hasText(value) && LEGACY_TRANSFER_CATEGORY.equalsIgnoreCase(value.trim())) {
                return true;
            }
        }
        return false;
    }

    private static String normalize(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
