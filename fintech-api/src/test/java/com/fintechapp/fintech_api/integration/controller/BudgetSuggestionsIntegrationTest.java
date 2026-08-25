package com.fintechapp.fintech_api.integration.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;

/**
 * End-to-end coverage for the Smart Month Setup endpoints
 * ({@code GET /api/budgets/suggestions} and {@code POST /api/budgets/apply-suggestions}).
 *
 * <p>Target and previous months derive from the real clock so the tests are
 * deterministic whenever they run (the service computes against
 * {@code Instant.now()}).</p>
 */
class BudgetSuggestionsIntegrationTest extends BaseIntegrationTest {

    private int targetYear;
    private int targetMonth;
    private int prevYear;
    private int prevMonth;

    {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        targetYear = today.getYear();
        targetMonth = today.getMonthValue() - 1; // zero-based
        if (targetMonth == 0) {
            prevMonth = 11;
            prevYear = targetYear - 1;
        } else {
            prevMonth = targetMonth - 1;
            prevYear = targetYear;
        }
    }

    private Instant monthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Budget createAutoCreatedBudget(User user, String category, double spent) {
        Budget b = new Budget();
        b.setUser(user);
        b.setCategory(category);
        b.setLimit(0);
        b.setAutoCreated(true);
        b.setSpent(spent);
        b.setDate(monthStart(targetYear, targetMonth));
        return budgetRepository.save(b);
    }

    @Test
    void getSuggestions_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/budgets/suggestions")
                        .queryParam("month", String.valueOf(targetMonth))
                        .queryParam("year", String.valueOf(targetYear)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getSuggestions_returnsPreviousMonthManualBudget_inherited() throws Exception {
        User user = createUser("suggest-inherit@example.com", "Password123!", "suggest-inherit");
        createBudget(user, "Food", 300, monthStart(prevYear, prevMonth));

        mockMvc.perform(get("/api/budgets/suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .queryParam("month", String.valueOf(targetMonth))
                        .queryParam("year", String.valueOf(targetYear)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.suggestions", hasSize(1)))
                .andExpect(jsonPath("$.data.suggestions[0].category").value("Food"))
                .andExpect(jsonPath("$.data.suggestions[0].suggestedLimit").value(300.0))
                .andExpect(jsonPath("$.data.suggestions[0].source").value("PREVIOUS_MONTH_BUDGET"))
                .andExpect(jsonPath("$.data.suggestions[0].inherited").value(true));
    }

    @Test
    void getSuggestions_excludesAutoCreatedPreviousMonthBudget() throws Exception {
        User user = createUser("suggest-auto@example.com", "Password123!", "suggest-auto");
        Budget auto = new Budget();
        auto.setUser(user);
        auto.setCategory("Food");
        auto.setLimit(0);
        auto.setAutoCreated(true);
        auto.setSpent(50);
        auto.setDate(monthStart(prevYear, prevMonth));
        budgetRepository.save(auto);

        mockMvc.perform(get("/api/budgets/suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .queryParam("month", String.valueOf(targetMonth))
                        .queryParam("year", String.valueOf(targetYear)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.suggestions", hasSize(0)));
    }

    @Test
    void getSuggestions_userIsolation() throws Exception {
        User owner = createUser("suggest-owner@example.com", "Password123!", "suggest-owner");
        User other = createUser("suggest-other@example.com", "Password123!", "suggest-other");
        createBudget(owner, "Rent", 1400, monthStart(prevYear, prevMonth));
        createBudget(other, "Rent", 9999, monthStart(prevYear, prevMonth));

        mockMvc.perform(get("/api/budgets/suggestions")
                        .header(authHeaderName(), authHeader(other))
                        .queryParam("month", String.valueOf(targetMonth))
                        .queryParam("year", String.valueOf(targetYear)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.suggestions[0].suggestedLimit").value(9999.0));
    }

    @Test
    void applySuggestions_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "month", targetMonth,
                                "year", targetYear,
                                "items", List.of(Map.of("category", "Food", "limit", 300.0))))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void applySuggestions_createsBudgets() throws Exception {
        User user = createUser("apply-create@example.com", "Password123!", "apply-create");

        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "month", targetMonth,
                                "year", targetYear,
                                "items", List.of(
                                        Map.of("category", "Food", "limit", 300.0),
                                        Map.of("category", "Transport", "limit", 100.0))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.created").value(2));

        org.junit.jupiter.api.Assertions.assertEquals(2,
                budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
    }

    @Test
    void applySuggestions_setsLimitOnAutoCreatedBudget_preservesSpentAndClearsFlag() throws Exception {
        User user = createUser("apply-auto@example.com", "Password123!", "apply-auto");
        Budget placeholder = createAutoCreatedBudget(user, "Food", 42);

        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "month", targetMonth,
                                "year", targetYear,
                                "items", List.of(Map.of("category", "Food", "limit", 90.0))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.updated").value(1));

        Budget reloaded = budgetRepository.findById(placeholder.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(90.0, reloaded.getLimit());
        org.junit.jupiter.api.Assertions.assertFalse(reloaded.isAutoCreated());
        org.junit.jupiter.api.Assertions.assertEquals(42.0, reloaded.getSpent(), 0.0001);
    }

    @Test
    void applySuggestions_doesNotOverwriteManualBudget() throws Exception {
        User user = createUser("apply-manual@example.com", "Password123!", "apply-manual");
        createBudget(user, "Food", 500, monthStart(targetYear, targetMonth));

        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "month", targetMonth,
                                "year", targetYear,
                                "items", List.of(Map.of("category", "Food", "limit", 90.0))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.skippedItems[0].reason").value("ALREADY_BUDGETED"));

        Budget reloaded = budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).get(0);
        org.junit.jupiter.api.Assertions.assertEquals(500.0, reloaded.getLimit());
    }

    @Test
    void applySuggestions_isIdempotent() throws Exception {
        User user = createUser("apply-idem@example.com", "Password123!", "apply-idem");
        Map<String, Object> body = Map.of(
                "month", targetMonth,
                "year", targetYear,
                "items", List.of(Map.of("category", "Food", "limit", 300.0)));

        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json()).content(asJson(body)))
                .andExpect(jsonPath("$.data.created").value(1));

        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json()).content(asJson(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.created").value(0))
                .andExpect(jsonPath("$.data.skipped").value(1));

        org.junit.jupiter.api.Assertions.assertEquals(1,
                budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
    }

    @Test
    void applySuggestions_validatesBadPayload() throws Exception {
        User user = createUser("apply-bad@example.com", "Password123!", "apply-bad");
        // Missing category → validation failure, nothing written.
        mockMvc.perform(post("/api/budgets/apply-suggestions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(asJson(Map.of(
                                "month", targetMonth,
                                "year", targetYear,
                                "items", List.of(Map.of("limit", 90.0))))))
                .andExpect(status().isBadRequest());
    }
}