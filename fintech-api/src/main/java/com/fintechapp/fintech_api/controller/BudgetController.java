package com.fintechapp.fintech_api.controller;

import java.time.LocalDate;
import java.time.ZoneOffset;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;
import jakarta.validation.Valid;

import com.fintechapp.fintech_api.dto.budget.ApplyBudgetSuggestionsResponse;
import com.fintechapp.fintech_api.dto.budget.ApplySuggestionsRequest;
import com.fintechapp.fintech_api.dto.budget.BudgetDataResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetIdResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetsResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetSuggestionsResponse;
import com.fintechapp.fintech_api.dto.budget.CreateBudgetRequest;
import com.fintechapp.fintech_api.dto.budget.UpdateBudgetRequest;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.service.BudgetService;
import com.fintechapp.fintech_api.service.BudgetSuggestionService;

@RestController
@RequestMapping({ "/api/budgets", "/api/budget" })
public class BudgetController {

    private final BudgetService budgetService;
    private final BudgetSuggestionService budgetSuggestionService;

    public BudgetController(BudgetService budgetService, BudgetSuggestionService budgetSuggestionService) {
        this.budgetService = budgetService;
        this.budgetSuggestionService = budgetSuggestionService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BudgetDataResponse createBudget(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody CreateBudgetRequest request) {
        return budgetService.createBudget(authenticatedUser, request);
    }

    @GetMapping
    public BudgetsResponse getBudgets(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String year) {
        return budgetService.getBudgets(authenticatedUser, month, year);
    }

    @DeleteMapping("/{budgetId}")
    public BudgetIdResponse deleteBudget(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable String budgetId) {
        return budgetService.deleteBudget(authenticatedUser, budgetId);
    }

    @RequestMapping(value = "/{budgetId}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public BudgetDataResponse updateBudget(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable String budgetId,
            @Valid @RequestBody UpdateBudgetRequest request) {
        return budgetService.updateBudget(authenticatedUser, budgetId, request);
    }

    /**
     * Computes conservative suggested limits for a month (previous month's
     * manual budgets, then recent completed-month spending). Read-only and
     * deterministic.
     */
    @GetMapping("/suggestions")
    public BudgetSuggestionsResponse getBudgetSuggestions(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String year) {
        int[] resolved = resolveMonthYear(year, month);
        return new BudgetSuggestionsResponse(
                true,
                "Budget suggestions retrieved successfully",
                budgetSuggestionService.suggestForAuthenticatedUser(
                        authenticatedUser, resolved[0], resolved[1]));
    }

    /**
     * Applies a user-confirmed batch of suggested budgets atomically. Safe to
     * call repeatedly; never overwrites an existing manual limit.
     */
    @PostMapping("/apply-suggestions")
    public ApplyBudgetSuggestionsResponse applySuggestions(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody ApplySuggestionsRequest request) {
        return budgetService.applyBudgetSuggestions(authenticatedUser, request);
    }

    /** Resolves month/year, defaulting to the current UTC month when absent/invalid. */
    private int[] resolveMonthYear(String yearRaw, String monthRaw) {
        Integer month = parseInteger(monthRaw);
        Integer year = parseInteger(yearRaw);
        if (month == null || year == null || month < 0 || month > 11 || year <= 0) {
            LocalDate utcNow = LocalDate.now(ZoneOffset.UTC);
            month = utcNow.getMonthValue() - 1;
            year = utcNow.getYear();
        }
        return new int[] { year, month };
    }

    private Integer parseInteger(String raw) {
        if (!org.springframework.util.StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
