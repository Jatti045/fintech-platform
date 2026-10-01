package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;

/** Regression coverage for the single persisted transfer classifier. */
@ExtendWith(MockitoExtension.class)
class PlaidInternalTransferReconciliationTest {
    @Mock TransactionRepository transactions;
    @Mock BudgetRepository budgets;
    @Mock UserRepository users;
    @Mock PlaidTransactionIngestService ingest;
    @Mock FinancialCacheInvalidator cache;
    InternalTransferReconciliationService service;
    User user;
    Budget budget;

    @BeforeEach void setup() {
        service = new InternalTransferReconciliationService(transactions, budgets, users, ingest, cache);
        user = new User(); user.setId("user-1");
        budget = new Budget(); budget.setId("budget-1");
        when(users.findByIdForUpdate("user-1")).thenReturn(Optional.of(user));
    }

    Transaction leg(String id, TransactionType type, int day) {
        Transaction tx = new Transaction(); tx.setId(id); tx.setPlaidTransactionId(id);
        tx.setUser(user); tx.setName("Bank movement"); tx.setCategory("Transfer");
        tx.setType(type); tx.setAmount(500); tx.setOriginalAmount(500.0); tx.setOriginalCurrency("USD");
        tx.setDate(Instant.parse("2026-03-" + String.format("%02d", day) + "T00:00:00Z"));
        tx.setPlaidAccountId(id + "-account"); tx.setPlaidItemId("item-1");
        tx.setPlaidPfcDetailed(type == TransactionType.EXPENSE ? "TRANSFER_OUT_ACCOUNT_TRANSFER" : "TRANSFER_IN_ACCOUNT_TRANSFER");
        if (type == TransactionType.EXPENSE) tx.setBudget(budget);
        return tx;
    }
    void rows(Transaction... rows) { when(transactions.findTransferCandidates("user-1")).thenReturn(List.of(rows)); }

    @Test void validPair_preservesRowsAndDirections_andReversesBudgetOnlyOnce() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        rows(out, in); service.reconcile("user-1"); service.reconcile("user-1");
        assertTrue(out.isTransfer()); assertTrue(in.isTransfer()); assertNull(out.getBudget());
        assertEquals(TransactionType.EXPENSE, out.getType()); assertEquals(TransactionType.INCOME, in.getType());
        verify(budgets, times(1)).decrementSpentClamped("budget-1", 500);
        verify(transactions, never()).delete(any(Transaction.class)); verify(transactions, times(2)).save(any());
    }

    @ParameterizedTest @ValueSource(ints = {1, 2, 3})
    void crossItemAndSettlementDelay_supported(int delay) {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15 + delay);
        in.setPlaidItemId("item-2"); in.setAmount(498); // converted totals need not equal
        rows(out, in); service.reconcile("user-1"); assertTrue(out.isTransfer()); assertTrue(in.isTransfer());
    }

    @Test void outsideDateWindow_notPaired() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 19);
        rows(out, in); service.reconcile("user-1"); assertFalse(out.isTransfer()); assertFalse(in.isTransfer());
    }

    @Test void payrollAndPurchaseDoNotBlockValidSameValuePair() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        Transaction payroll = leg("pay", TransactionType.INCOME, 15), rent = leg("rent", TransactionType.EXPENSE, 15);
        payroll.setPlaidPfcDetailed("INCOME_WAGES"); rent.setPlaidPfcDetailed("RENT_AND_UTILITIES_RENT");
        rows(out, in, payroll, rent); service.reconcile("user-1");
        assertTrue(out.isTransfer()); assertTrue(in.isTransfer()); assertFalse(payroll.isTransfer()); assertFalse(rent.isTransfer());
    }

    @ParameterizedTest @ValueSource(strings = {"TRANSFER_IN_PAYROLL", "TRANSFER_IN_REFUND", "TRANSFER_IN_DEPOSIT", "TRANSFER_IN_THIRD_PARTY_P2P", "TRANSFER_IN", "INCOME_OTHER_INCOME", "TRANSFER_IN_ACCOUNT_TRANSFER_FAKE"})
    void nonTransferEvidenceNeverPairs(String code) {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        in.setPlaidPfcDetailed(code); in.setName("PAYMENT THANK YOU");
        rows(out, in); service.reconcile("user-1"); assertFalse(out.isTransfer()); assertFalse(in.isTransfer());
    }

    @ParameterizedTest @ValueSource(strings = {"ACME Payroll", "Purchase refund", "Employee reimbursement", "ATM withdrawal", "Venmo", "PayPal", "Cash App"})
    void contradictoryNameBlocksIncorrectTransferCategory(String name) {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        in.setName(name); rows(out, in); service.reconcile("user-1");
        assertFalse(out.isTransfer()); assertFalse(in.isTransfer());
    }

    @Test void differentUsersNeverPair_evenIfRepositoryReturnedForeignRow() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        User foreign = new User(); foreign.setId("user-2"); in.setUser(foreign);
        rows(out, in); service.reconcile("user-1"); assertFalse(out.isTransfer()); assertFalse(in.isTransfer());
    }

    @Test void sameAccountNeverPairs() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        in.setPlaidAccountId(out.getPlaidAccountId()); rows(out, in); service.reconcile("user-1"); assertFalse(out.isTransfer());
    }

    @Test void originalCurrencyMustMatch() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        in.setOriginalCurrency("CAD"); rows(out, in); service.reconcile("user-1"); assertFalse(out.isTransfer());
    }

    @Test void multipleDistinguishablePairsMatch_withoutWholeGroupRejection() {
        Transaction a = leg("a", TransactionType.EXPENSE, 5), b = leg("b", TransactionType.INCOME, 6);
        Transaction c = leg("c", TransactionType.EXPENSE, 15), d = leg("d", TransactionType.INCOME, 16);
        rows(a, b, c, d); service.reconcile("user-1");
        assertTrue(a.isTransfer()); assertTrue(b.isTransfer()); assertTrue(c.isTransfer()); assertTrue(d.isTransfer());
    }

    @Test void equallyPlausiblePairsNeverGuessed() {
        Transaction a = leg("a", TransactionType.EXPENSE, 15), b = leg("b", TransactionType.INCOME, 15);
        Transaction c = leg("c", TransactionType.EXPENSE, 15), d = leg("d", TransactionType.INCOME, 15);
        rows(a, b, c, d); service.reconcile("user-1");
        assertFalse(a.isTransfer()); assertFalse(b.isTransfer()); assertFalse(c.isTransfer()); assertFalse(d.isTransfer());
        verify(budgets, never()).decrementSpentClamped(anyString(), anyDouble());
    }

    @Test void removalOfCounterpart_restoresLoneExpenseOnlyOnce() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15); out.setTransfer(true); out.setBudget(null);
        when(ingest.resolveOrCreateBudget(user, "Transfer", out.getDate())).thenReturn(budget);
        rows(out); service.reconcile("user-1"); service.reconcile("user-1");
        assertFalse(out.isTransfer()); assertSame(budget, out.getBudget()); verify(budgets, times(1)).incrementSpent("budget-1", 500);
    }

    @ParameterizedTest @ValueSource(strings = {"amount", "account", "date", "category"})
    void modificationInvalidatesBothLegs(String field) {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        out.setTransfer(true); in.setTransfer(true); out.setBudget(null);
        switch (field) {
            case "amount" -> in.setOriginalAmount(501.0);
            case "account" -> in.setPlaidAccountId(out.getPlaidAccountId());
            case "date" -> in.setDate(Instant.parse("2026-03-20T00:00:00Z"));
            case "category" -> in.setPlaidPfcDetailed("INCOME_WAGES");
        }
        when(ingest.resolveOrCreateBudget(user, "Transfer", out.getDate())).thenReturn(budget);
        rows(out, in); service.reconcile("user-1"); assertFalse(out.isTransfer()); assertFalse(in.isTransfer());
        verify(budgets).incrementSpent("budget-1", 500);
    }

    @Test void pendingAndReplacedPendingAreNotIndependentLegs() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), pending = leg("pending", TransactionType.INCOME, 15);
        Transaction posted = leg("posted", TransactionType.INCOME, 16);
        pending.setPlaidPending(true); posted.setPlaidPending(false); posted.setPlaidPendingTransactionId("pending");
        rows(out, pending, posted); service.reconcile("user-1");
        assertTrue(out.isTransfer()); assertTrue(posted.isTransfer()); assertFalse(pending.isTransfer());
        // Even historical rows with unknown pending status cannot act as a second leg.
        pending.setPlaidPending(null); service.reconcile("user-1"); assertFalse(pending.isTransfer());
    }

    @Test void historyOnlyClassifiesCompleteUnambiguousPairs_andRebuildsSpent() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        Transaction incomplete = leg("old", TransactionType.EXPENSE, 15); incomplete.setOriginalAmount(null);
        rows(out, in, incomplete); service.reconcileHistory("user-1"); service.reconcileHistory("user-1");
        assertTrue(out.isTransfer()); assertFalse(incomplete.isTransfer());
        verify(budgets).recalculateSpent("budget-1"); verify(budgets, times(1)).decrementSpentClamped("budget-1", 500);
    }

    @Test void creditCardPaymentWithOwnedCounterpart_isTransfer() {
        Transaction out = leg("out", TransactionType.EXPENSE, 15), in = leg("in", TransactionType.INCOME, 15);
        out.setPlaidPfcDetailed("LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"); in.setPlaidPfcDetailed("LOAN_PAYMENTS_CREDIT_CARD_PAYMENT");
        rows(out, in); service.reconcile("user-1"); assertTrue(out.isTransfer()); assertTrue(in.isTransfer());
    }
}
