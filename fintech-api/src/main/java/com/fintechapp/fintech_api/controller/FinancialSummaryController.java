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
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse;
import com.fintechapp.fintech_api.service.FinancialSummaryService;
import com.fintechapp.fintech_api.service.FinancialReportService;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Exposes month-scoped financial aggregates. Aggregates live here — not on the
 * transaction endpoints, which are concerned only with transactions.
 */
@RestController
@RequestMapping("/api/financial-summary")
public class FinancialSummaryController {

    private final FinancialSummaryService financialSummaryService;
    private final FinancialReportService reports;

    public FinancialSummaryController(FinancialSummaryService financialSummaryService, FinancialReportService reports) {
        this.reports = reports;
        this.financialSummaryService = financialSummaryService;
    }

    @GetMapping
    public FinancialSummaryResponse getFinancialSummary(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String year) {
        int[] resolved = resolveMonthYear(year, month);
        return new FinancialSummaryResponse(
                true,
                "Financial summary retrieved successfully",
                financialSummaryService.resolveForAuthenticatedUser(
                        authenticatedUser,
                        resolved[0],
                        resolved[1]));
    }

    @GetMapping("/report")
    public FinancialReportResponse getReport(
            @AuthenticationPrincipal AuthenticatedUser auth, @RequestParam(required = false) String month, @RequestParam(required = false) String year) {
        Integer m = parseInteger(month), y = parseInteger(year);
        if (m == null || y == null || m < 0 || m > 11 || y < 1 || y > 9998) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid month and year are required");
        }
        return new FinancialReportResponse(true, "Monthly report loaded", reports.report(auth, y, m));
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

