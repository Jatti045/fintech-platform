package com.fintechapp.fintech_api.integration.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Goal;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;

class FinancialSummaryControllerIntegrationTest extends BaseIntegrationTest {

    // Asserts the summary endpoint returns month-wide spending totals and
    // effective income (expected baseline when no inflow is logged).
    @Test
    void getFinancialSummary_returnsSpendingAndIncomeAggregates() throws Exception {
        User user = createUser("summary-basic@example.com", "Password123!", "summary-basic");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);

        createMonthlyIncome(user, monthStart, 4000.0);
        Budget food = createBudget(user, "Food", 500, monthStart);
        createTransaction(user, food, null, "Groceries", monthStart.plusSeconds(3600), "Food", TransactionType.EXPENSE, 150.0);
        createTransaction(user, food, null, "Dinner", monthStart.plusSeconds(7200), "Food", TransactionType.EXPENSE, 50.0);

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalAmount").value(200.0))
                .andExpect(jsonPath("$.data.monthlyIncome").value(4000.0))
                .andExpect(jsonPath("$.data.expectedIncome").value(4000.0))
                .andExpect(jsonPath("$.data.actualIncome").value(0.0))
                .andExpect(jsonPath("$.data.netSpent").value(200.0))
                .andExpect(jsonPath("$.data.netRemaining").value(3800.0))
                .andExpect(jsonPath("$.data.spentPercentageOfIncome").value(5.0))
                .andExpect(jsonPath("$.data.goalAllocationAmount").value(0.0));
    }

    // Asserts effective income uses actual inflow (sum of INCOME transactions)
    // when income transactions exist, while still reporting expected separately.
    @Test
    void getFinancialSummary_effectiveIncomeUsesActualInflow() throws Exception {
        User user = createUser("summary-actual@example.com", "Password123!", "summary-actual");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Budget incomeBudget = createBudget(user, "Income", 0, monthStart);
        createMonthlyIncome(user, monthStart, 4000.0);
        createTransaction(user, incomeBudget, null, "Paycheck", monthStart.plusSeconds(3600), "Income", TransactionType.INCOME, 3000.0);

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.monthlyIncome").value(3000.0))
                .andExpect(jsonPath("$.data.expectedIncome").value(4000.0))
                .andExpect(jsonPath("$.data.actualIncome").value(3000.0));
    }

    // Asserts the summary endpoint carries the previous month's income forward
    // into the current month when no baseline exists for the current month.
    @Test
    void getFinancialSummary_currentMonthFallsBackToPreviousIncome() throws Exception {
        User user = createUser("summary-carry@example.com", "Password123!", "summary-carry");
        LocalDate currentUtc = LocalDate.now(ZoneOffset.UTC);
        LocalDate previousUtc = currentUtc.minusMonths(1);

        createMonthlyIncome(
                user,
                LocalDate.of(previousUtc.getYear(), previousUtc.getMonthValue(), 1).atStartOfDay().toInstant(ZoneOffset.UTC),
                3500.0);

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(currentUtc.getMonthValue() - 1))
                        .param("year", String.valueOf(currentUtc.getYear())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.monthlyIncome").value(3500.0));
    }

    // Asserts goal allocations are included in the month's total spending.
    @Test
    void getFinancialSummary_includesGoalAllocationsInTotalAmount() throws Exception {
        User user = createUser("summary-goal@example.com", "Password123!", "summary-goal");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);

        createMonthlyIncome(user, monthStart, 5000.0);
        Budget food = createBudget(user, "Food", 500, monthStart);
        createTransaction(user, food, null, "Groceries", monthStart.plusSeconds(3600), "Food", TransactionType.EXPENSE, 100.0);

        Goal goal = createGoal(user, 1000, 0, "flag");
        goalRepository.save(goal);

        org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder allocate =
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/goals/{goalId}/allocate", goal.getId())
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(java.util.Map.of("amount", 250.0)));
        mockMvc.perform(allocate).andExpect(status().isOk());

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalAmount").value(350.0))
                .andExpect(jsonPath("$.data.goalAllocationAmount").value(250.0));
    }

    // Asserts a different month is isolated from the current month's totals.
    @Test
    void getFinancialSummary_isIsolatedPerMonth() throws Exception {
        User user = createUser("summary-month@example.com", "Password123!", "summary-month");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant currentStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant prevStart = LocalDate.of(year, month + 1, 1).minusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        createMonthlyIncome(user, currentStart, 3000.0);
        createMonthlyIncome(user, prevStart, 2000.0);
        Budget food = createBudget(user, "Food", 500, currentStart);
        createTransaction(user, food, null, "This month", currentStart.plusSeconds(3600), "Food", TransactionType.EXPENSE, 100.0);
        createTransaction(user, food, null, "Last month", prevStart.plusSeconds(3600), "Food", TransactionType.EXPENSE, 50.0);

        int prevMonth = month - 1 < 0 ? 11 : month - 1;
        int prevYear = month - 1 < 0 ? year - 1 : year;

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalAmount").value(100.0))
                .andExpect(jsonPath("$.data.monthlyIncome").value(3000.0));

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(prevMonth))
                        .param("year", String.valueOf(prevYear)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalAmount").value(50.0))
                .andExpect(jsonPath("$.data.monthlyIncome").value(2000.0));
    }

    // Asserts the summary endpoint rejects unauthenticated access.
    @Test
    void getFinancialSummary_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/financial-summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── Transfers between the user's own accounts ────────────────────────────
    // Checking → Savings ($2,000 out) + Savings ← Checking ($2,000 in) must not
    // count as spending or income. Only real activity moves the aggregates.

    @Test
    void getFinancialSummary_transfersAreExcludedFromIncomeAndExpenses() throws Exception {
        User user = createUser("summary-transfer@example.com", "Password123!", "summary-transfer");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);

        createMonthlyIncome(user, monthStart, 2500.0);

        // Real activity.
        Budget food = createBudget(user, "Food", 500, monthStart);
        createTransaction(user, food, null, "Groceries", monthStart.plusSeconds(3600), "Food", TransactionType.EXPENSE, 100.0);
        createTransaction(user, food, null, "Paycheck", monthStart.plusSeconds(7200), "Income", TransactionType.INCOME, 2500.0);

        // Internal transfer pair (Checking → Savings), marked is_transfer.
        Transaction transferOut = new Transaction();
        transferOut.setUser(user);
        transferOut.setName("Transfer to Savings");
        transferOut.setDate(monthStart.plusSeconds(10_000));
        transferOut.setCategory("Transfer");
        transferOut.setType(TransactionType.EXPENSE);
        transferOut.setAmount(2000.0);
        transferOut.setTransfer(true);
        transactionRepository.save(transferOut);

        Transaction transferIn = new Transaction();
        transferIn.setUser(user);
        transferIn.setName("Transfer from Checking");
        transferIn.setDate(monthStart.plusSeconds(10_000));
        transferIn.setCategory("Transfer");
        transferIn.setType(TransactionType.INCOME);
        transferIn.setAmount(2000.0);
        transferIn.setTransfer(true);
        transactionRepository.save(transferIn);

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalAmount").value(100.0))
                .andExpect(jsonPath("$.data.monthlyIncome").value(2500.0))
                .andExpect(jsonPath("$.data.actualIncome").value(2500.0))
                .andExpect(jsonPath("$.data.netRemaining").value(2400.0));
    }

    // ── Transfers stay visible in transaction history ────────────────────────

    @Test
    void getTransactions_transfersRemainInHistory() throws Exception {
        User user = createUser("summary-transfer-history@example.com", "Password123!", "summary-transfer-history");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);

        Transaction transferOut = new Transaction();
        transferOut.setUser(user);
        transferOut.setName("Transfer to Savings");
        transferOut.setDate(monthStart.plusSeconds(10_000));
        transferOut.setCategory("Transfer");
        transferOut.setType(TransactionType.EXPENSE);
        transferOut.setAmount(2000.0);
        transferOut.setTransfer(true);
        transactionRepository.save(transferOut);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/transaction")
                        .header(authHeaderName(), authHeader(user))
                        .param("currentMonth", String.valueOf(month))
                        .param("currentYear", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.transaction[0].name").value("Transfer to Savings"))
                .andExpect(jsonPath("$.data.transaction[0].isTransfer").value(true));
    }
}
