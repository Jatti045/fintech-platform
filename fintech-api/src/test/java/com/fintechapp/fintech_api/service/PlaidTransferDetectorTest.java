package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Tests for {@link PlaidTransferDetector} under the strict transfer rule.
 *
 * <p>The only transfer is money moved between two accounts owned by the same
 * user at the same financial institution. The application does not persist
 * {@code account_id} or a transaction-to-Plaid-item link, so it cannot prove
 * that ownership from the available data. The safe behavior is therefore that
 * the detector returns {@code false} for everything: money in is income, money
 * out is an expense, and no external movement is wrongly excluded. Plaid
 * categories (TRANSFER_IN/OUT, LOAN_PAYMENTS, legacy "Transfer", ...) are
 * classification signals, not proof of account ownership.</p>
 */
class PlaidTransferDetectorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode node(String json) throws Exception {
        return mapper.readTree(json);
    }

    // ── Same-bank internal transfers: cannot be proven with current data ──────

    @Test
    void sameBankCheckingToSavings_isNotTransferBecauseOwnershipCannotBeProven() throws Exception {
        // Checking → Savings at the same bank is a transfer in reality, but the
        // detector has no account/item ownership data to prove it, so the safe
        // default applies. (Documented limitation — see PlaidTransferDetector.)
        JsonNode out = node("""
                { "transaction_id": "t1",
                  "name": "Transfer to Savings",
                  "amount": 1000.0,
                  "personal_finance_category": {
                      "primary": "TRANSFER_OUT",
                      "detailed": "TRANSFER_OUT_ACCOUNT_TRANSFER" } }
                """);
        JsonNode in = node("""
                { "transaction_id": "t2",
                  "name": "Transfer from Checking",
                  "amount": -1000.0,
                  "personal_finance_category": {
                      "primary": "TRANSFER_IN",
                      "detailed": "TRANSFER_IN_ACCOUNT_TRANSFER" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(out));
        assertFalse(PlaidTransferDetector.isTransfer(in));
    }

    @Test
    void sameBankCheckingToCreditCardPayment_isNotTransferBecauseOwnershipCannotBeProven() throws Exception {
        // Same-user/same-bank credit card payment cannot be established from the
        // persisted data, so it defaults to an expense (no heuristic invented).
        JsonNode n = node("""
                { "transaction_id": "t3",
                  "name": "PAYMENT THANK YOU",
                  "amount": 500.0,
                  "personal_finance_category": {
                      "primary": "LOAN_PAYMENTS",
                      "detailed": "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    // ── Categories are signals, not proof of ownership ───────────────────────

    @Test
    void transferOutPrimary_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t4",
                  "name": "Checking to Savings",
                  "personal_finance_category": { "primary": "TRANSFER_OUT" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void transferInPrimary_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t5",
                  "personal_finance_category": { "primary": "TRANSFER_IN" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void legacyTransferCategory_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "t6",
                  "category": ["Transfer", "Internal Account Transfer"] }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void missingCategories_isNotTransfer() throws Exception {
        JsonNode n = node("{ \"transaction_id\": \"t7\", \"name\": \"Cash\" }");
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    // ── External money in → income (never a transfer) ─────────────────────────

    @Test
    void payrollPfc_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "p1",
                  "name": "ACME CORP",
                  "amount": -2500.0,
                  "personal_finance_category": {
                      "primary": "INCOME",
                      "detailed": "INCOME_PAYROLL",
                      "subcategory": "INCOME_PAYROLL" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void payrollDepositDescription_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "p2",
                  "description": "PAYROLL DEPOSIT CGI INFORM.MANAG.CONS",
                  "amount": -1500.0,
                  "personal_finance_category": { "primary": "TRANSFER_IN" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void payrollAchPpdId_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "p3",
                  "description": "Sweetgreen inc payroll ppd id",
                  "amount": -800.0,
                  "personal_finance_category": { "primary": "TRANSFER_IN" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void venmoIncoming_isNotTransfer() throws Exception {
        // P2P money received is external income — the user did not move money
        // between two of their own accounts at the same bank.
        JsonNode n = node("""
                { "transaction_id": "v1",
                  "name": "Venmo",
                  "amount": -200.0,
                  "personal_finance_category": { "primary": "TRANSFER_IN" },
                  "category": ["Transfer", "P2P"] }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void cashDeposit_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "d1",
                  "name": "CASH DEPOSIT",
                  "amount": -500.0,
                  "personal_finance_category": { "primary": "TRANSFER_IN" },
                  "category": ["Transfer", "Deposit"] }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void interestIncome_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "i1",
                  "name": "Interest",
                  "amount": -12.0,
                  "personal_finance_category": {
                      "primary": "INCOME",
                      "detailed": "INCOME_INTEREST" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void refund_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "r1",
                  "name": "REFUND",
                  "amount": -45.0,
                  "personal_finance_category": { "primary": "TRANSFER_IN" },
                  "category": ["Transfer", "Deposit", "Refund"] }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    // ── External money out → expense (never a transfer) ───────────────────────

    @Test
    void loanPayment_isNotTransfer() throws Exception {
        // Oportun / car / mortgage / student loan payments leave the user's
        // account to an external lender — expenses, not transfers.
        JsonNode n = node("""
                { "transaction_id": "l1",
                  "name": "Oportun",
                  "amount": 387.97,
                  "personal_finance_category": {
                      "primary": "LOAN_PAYMENTS",
                      "detailed": "LOAN_PAYMENTS_OTHER" },
                  "category": ["Loan Payments", "Other"] }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void creditCardPurchase_isNotTransfer() throws Exception {
        // Ordinary purchases made with a credit card are real expenses.
        JsonNode n = node("""
                { "transaction_id": "n1",
                  "name": "Netflix",
                  "amount": 15.99,
                  "personal_finance_category": {
                      "primary": "ENTERTAINMENT",
                      "detailed": "ENTERTAINMENT_MEDIA_AND_STREAMING" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void differentBankTransfer_isNotTransfer() throws Exception {
        // Bank A checking → Bank B savings is NOT an internal transfer under
        // the rule (different financial institutions) — it is a real expense.
        JsonNode n = node("""
                { "transaction_id": "x1",
                  "name": "External Transfer",
                  "amount": 750.0,
                  "personal_finance_category": {
                      "primary": "TRANSFER_OUT",
                      "detailed": "TRANSFER_OUT_ACCOUNT_TRANSFER" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }

    @Test
    void interestPaid_isNotTransfer() throws Exception {
        JsonNode n = node("""
                { "transaction_id": "i2",
                  "name": "Loan Interest",
                  "amount": 88.0,
                  "personal_finance_category": {
                      "primary": "LOAN_PAYMENTS",
                      "detailed": "LOAN_PAYMENTS_INTEREST_PAYMENT" } }
                """);
        assertFalse(PlaidTransferDetector.isTransfer(n));
    }
}
