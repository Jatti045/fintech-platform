package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Tests for {@link PlaidTransferDetector}: a transaction is a transfer only
 * when its structured Plaid categorization says so — never based on the word
 * "transfer" appearing in a merchant name.
 */
class PlaidTransferDetectorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode node(String json) throws Exception {
        return mapper.readTree(json);
    }

    @Test
    void modernCategory_transferOut_isTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t1",
                  "name": "Checking to Savings",
                  "personal_finance_category": {
                      "primary": "TRANSFER_OUT",
                      "detailed": "TRANSFER_OUT",
                      "subcategory": "TRANSFER_OUT" } }
                """);
        assertTrue(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void modernCategory_transferIn_isTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t2",
                  "personal_finance_category": { "primary": "TRANSFER_IN" } }
                """);
        assertTrue(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void legacyCategory_transfer_isTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t3",
                  "category": ["Transfer", "Internal Account Transfer"] }
                """);
        assertTrue(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void modernCategory_normalPurchase_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t4",
                  "name": "Starbucks",
                  "personal_finance_category": {
                      "primary": "FOOD_AND_DRINK",
                      "detailed": "FOOD_AND_DRINK_COFFEE",
                      "subcategory": "FOOD_AND_DRINK_COFFEE" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void legacyCategory_food_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t5",
                  "category": ["Food and Drink", "Restaurants"] }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void nameContainsTransfer_butCategorizedAsFee_isNotTransfer() throws Exception {
        // The word "transfer" in a merchant name is NOT evidence on its own.
        JsonNode n = node("""
                { "transaction_id": "t6",
                  "name": "Money Transfer Fee",
                  "merchant_name": "Western Union",
                  "personal_finance_category": {
                      "primary": "BANK_FEES",
                      "detailed": "BANK_FEES",
                      "subcategory": "BANK_FEES" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void missingCategories_isNotTransfer() throws Exception {
        JsonNode n = node("{ \"transaction_id\": \"t7\", \"name\": \"Cash\" }");
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void nullNode_isNotTransfer() {
        assertFalse(PlaidTransferDetector.isTransfer(null));
    }
}
