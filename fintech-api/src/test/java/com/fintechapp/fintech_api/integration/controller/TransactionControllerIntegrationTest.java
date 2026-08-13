package com.fintechapp.fintech_api.integration.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.AbstractMap;
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;

class TransactionControllerIntegrationTest extends BaseIntegrationTest {

    // Asserts create transaction succeeds and updates linked budget spent for expense transactions.
    @Test
    void createTransaction_validExpenseRequest_createsTransactionAndUpdatesBudget() throws Exception {
        User user = createUser("tx-create@example.com", "Password123!", "tx-create");
        Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));

        mockMvc.perform(post("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.ofEntries(
                                new AbstractMap.SimpleEntry<>("name", "Lunch"),
                                new AbstractMap.SimpleEntry<>("month", 2),
                                new AbstractMap.SimpleEntry<>("year", 2026),
                                new AbstractMap.SimpleEntry<>("date", "2026-03-05T10:00:00Z"),
                                new AbstractMap.SimpleEntry<>("category", "Food"),
                                new AbstractMap.SimpleEntry<>("type", "EXPENSE"),
                                new AbstractMap.SimpleEntry<>("amount", 18.73),
                                new AbstractMap.SimpleEntry<>("baseCurrency", "USD"),
                                new AbstractMap.SimpleEntry<>("originalAmount", 25.5),
                                new AbstractMap.SimpleEntry<>("originalCurrency", "SGD"),
                                new AbstractMap.SimpleEntry<>("budgetId", budget.getId()),
                                new AbstractMap.SimpleEntry<>("description", "Team lunch")
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.transaction.name").value("Lunch"))
                .andExpect(jsonPath("$.data.transaction.amount").value(18.73))
                .andExpect(jsonPath("$.data.transaction.baseCurrency").value("USD"))
                .andExpect(jsonPath("$.data.transaction.originalAmount").value(25.5))
                .andExpect(jsonPath("$.data.transaction.originalCurrency").value("SGD"));

        Budget updatedBudget = budgetRepository.findById(budget.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(18.73, updatedBudget.getSpent());

        Transaction savedTx = transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).get(0);
        org.junit.jupiter.api.Assertions.assertEquals(18.73, savedTx.getAmount());
        org.junit.jupiter.api.Assertions.assertEquals("USD", savedTx.getBaseCurrency());
        org.junit.jupiter.api.Assertions.assertEquals(25.5, savedTx.getOriginalAmount());
        org.junit.jupiter.api.Assertions.assertEquals("SGD", savedTx.getOriginalCurrency());
    }

    // Asserts an income transaction can be created without a linked budget.
    @Test
    void createTransaction_incomeWithoutBudget_returnsCreated() throws Exception {
        User user = createUser("tx-income@example.com", "Password123!", "tx-income");

        mockMvc.perform(post("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "name", "Salary",
                                "month", 2,
                                "year", 2026,
                                "date", "2026-03-01T08:00:00Z",
                                "category", "Income",
                                "type", "INCOME",
                                "amount", 3000.0,
                                "baseCurrency", "USD"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.transaction.name").value("Salary"))
                .andExpect(jsonPath("$.data.transaction.type").value("INCOME"))
                .andExpect(jsonPath("$.data.transaction.amount").value(3000.0));

        // No budget is attached, and the expense flow did not create one.
        org.junit.jupiter.api.Assertions.assertEquals(
                0, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
    }

    // Asserts create transaction rejects missing required fields with 400.
    @Test
    void createTransaction_missingRequiredField_returnsBadRequest() throws Exception {
        User user = createUser("tx-missing@example.com", "Password123!", "tx-missing");
        Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));

        mockMvc.perform(post("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "month", 2,
                                "year", 2026,
                                "date", "2026-03-05T10:00:00Z",
                                "category", "Food",
                                "type", "EXPENSE",
                                "amount", 25.5,
                                "budgetId", budget.getId()
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts create transaction rejects invalid transaction type and does not persist partial state.
    @Test
    void createTransaction_invalidType_returnsBadRequestAndDoesNotPersist() throws Exception {
        User user = createUser("tx-invalid-type@example.com", "Password123!", "tx-invalid-type");
        Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));

        mockMvc.perform(post("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "name", "Lunch",
                                "month", 2,
                                "year", 2026,
                                "date", "2026-03-05T10:00:00Z",
                                "category", "Food",
                                "type", "INVALID",
                                "amount", 25.5,
                                "budgetId", budget.getId()
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        org.junit.jupiter.api.Assertions.assertEquals(0, transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
    }

    // Asserts create transaction endpoint rejects unauthenticated requests.
    @Test
    void createTransaction_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/transactions")
                        .contentType(json())
                        .content(asJson(Map.of("name", "Lunch"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts get transactions returns persisted transactions with success response.
    @Test
    void getTransactions_validToken_returnsTransactions() throws Exception {
        User user = createUser("tx-list@example.com", "Password123!", "tx-list");
        Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
        createTransaction(user, budget, null, "Lunch", Instant.parse("2026-03-05T10:00:00Z"), "Food", TransactionType.EXPENSE, 25.5);

        mockMvc.perform(get("/api/transactions")
                        .header(authHeaderName(), authHeader(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                .andExpect(jsonPath("$.data.transaction[0].name").value("Lunch"));
    }

    // Asserts transaction summary carries previous month's income forward into the current month.
    @Test
    void getTransactions_currentMonthFallsBackToPreviousIncome() throws Exception {
        User user = createUser("tx-income-carry@example.com", "Password123!", "tx-income-carry");
        LocalDate currentUtc = LocalDate.now(ZoneOffset.UTC);
        LocalDate previousUtc = currentUtc.minusMonths(1);

        createMonthlyIncome(
                user,
                LocalDate.of(previousUtc.getYear(), previousUtc.getMonthValue(), 1).atStartOfDay().toInstant(ZoneOffset.UTC),
                3500.0);

        mockMvc.perform(get("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .param("currentMonth", String.valueOf(currentUtc.getMonthValue() - 1))
                        .param("currentYear", String.valueOf(currentUtc.getYear())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summary.monthlyIncome").value(3500.0));
    }

    // Asserts effective income uses actual inflow (sum of INCOME transactions)
    // when income transactions exist, while still reporting expected separately.
    @Test
    void getTransactions_effectiveIncomeUsesActualInflow() throws Exception {
        User user = createUser("tx-income-actual@example.com", "Password123!", "tx-income-actual");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Budget budget = createBudget(user, "Income", 0, monthStart);
        createMonthlyIncome(user, monthStart, 4000.0);
        createTransaction(user, budget, null, "Paycheck", monthStart.plusSeconds(3600), "Income", TransactionType.INCOME, 3000.0);

        mockMvc.perform(get("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .param("currentMonth", String.valueOf(month))
                        .param("currentYear", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summary.monthlyIncome").value(3000.0))
                .andExpect(jsonPath("$.data.summary.expectedIncome").value(4000.0))
                .andExpect(jsonPath("$.data.summary.actualIncome").value(3000.0));
    }

    // Asserts effective income falls back to the expected baseline when no
    // income transactions are logged for the month.
    @Test
    void getTransactions_effectiveIncomeFallsBackToExpected() throws Exception {
        User user = createUser("tx-income-fallback@example.com", "Password123!", "tx-income-fallback");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
        createMonthlyIncome(user, monthStart, 4200.0);

        mockMvc.perform(get("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .param("currentMonth", String.valueOf(month))
                        .param("currentYear", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summary.monthlyIncome").value(4200.0))
                .andExpect(jsonPath("$.data.summary.expectedIncome").value(4200.0))
                .andExpect(jsonPath("$.data.summary.actualIncome").value(0.0));
    }

    // Asserts get transactions endpoint rejects unauthenticated access.
    @Test
    void getTransactions_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/transactions"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts update transaction succeeds and persists updated amount.
    @Test
    void updateTransaction_validPatch_updatesTransaction() throws Exception {
        User user = createUser("tx-update@example.com", "Password123!", "tx-update");
        Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
        Transaction transaction = createTransaction(
                user,
                budget,
                null,
                "Lunch",
                Instant.parse("2026-03-05T10:00:00Z"),
                "Food",
                TransactionType.EXPENSE,
                25.5
        );
        budget.setSpent(25.5);
        budgetRepository.save(budget);

        mockMvc.perform(patch("/api/transactions/{transactionId}", transaction.getId())
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of("amount", 40.0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.transaction.amount").value(40.0));

        Transaction reloaded = transactionRepository.findById(transaction.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(40.0, reloaded.getAmount());
    }

    // Asserts update transaction with unknown id returns 404.
    @Test
    void updateTransaction_nonExistentId_returnsNotFound() throws Exception {
        User user = createUser("tx-update-missing@example.com", "Password123!", "tx-update-missing");

        mockMvc.perform(patch("/api/transactions/{transactionId}", "missing-id")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of("amount", 40.0))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts update transaction endpoint rejects unauthenticated access.
    @Test
    void updateTransaction_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(patch("/api/transactions/{transactionId}", "any-id")
                        .contentType(json())
                        .content(asJson(Map.of("amount", 40.0))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts delete transaction removes the transaction row and returns deleted ID.
    @Test
    void deleteTransaction_existingId_deletesTransaction() throws Exception {
        User user = createUser("tx-delete@example.com", "Password123!", "tx-delete");
        Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
        Transaction transaction = createTransaction(
                user,
                budget,
                null,
                "Lunch",
                Instant.parse("2026-03-05T10:00:00Z"),
                "Food",
                TransactionType.EXPENSE,
                25.5
        );
        budget.setSpent(25.5);
        budgetRepository.save(budget);

        mockMvc.perform(delete("/api/transactions/{transactionId}", transaction.getId())
                        .header(authHeaderName(), authHeader(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.deletedTransactionId").value(transaction.getId()));

        org.junit.jupiter.api.Assertions.assertFalse(transactionRepository.findById(transaction.getId()).isPresent());
    }

    // Asserts delete transaction with unknown id returns 404.
    @Test
    void deleteTransaction_nonExistentId_returnsNotFound() throws Exception {
        User user = createUser("tx-delete-missing@example.com", "Password123!", "tx-delete-missing");

        mockMvc.perform(delete("/api/transactions/{transactionId}", "missing-id")
                        .header(authHeaderName(), authHeader(user)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts delete transaction endpoint rejects unauthenticated access.
    @Test
    void deleteTransaction_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/transactions/{transactionId}", "any-id"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    // TODO: RBAC is not implemented in current security config (no role claims/authorities checks).
    @Disabled("TODO: Enable when endpoint-level role authorization is implemented")
    @Test
    void deleteTransaction_validTokenWrongRole_returnsForbidden() {
    }
}

