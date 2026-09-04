package com.fintechapp.fintech_api.controller;

import java.time.LocalDate;
import java.time.ZoneOffset;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.insight.MonthlyInsightResponse;
import com.fintechapp.fintech_api.service.MonthlyInsightService;

/**
 * Exposes AI-generated explanations on top of Budgee's deterministic financial
 * aggregates. All facts come from the existing financial services; the provider
 * never calculates and its errors are never surfaced raw.
 */
@RestController
@RequestMapping("/api/insights")
public class InsightController {

    private final MonthlyInsightService monthlyInsightService;

    public InsightController(MonthlyInsightService monthlyInsightService) {
        this.monthlyInsightService = monthlyInsightService;
    }

    @GetMapping("/monthly")
    public MonthlyInsightResponse getMonthlyInsight(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String year) {
        int[] resolved = resolveMonthYear(year, month);
        return monthlyInsightService.generateForAuthenticatedUser(
                authenticatedUser,
                resolved[0],
                resolved[1]);
    }

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
        if (!StringUtils.hasText(raw)) {
            return null;
        }

        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
