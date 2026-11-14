package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse.Report;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;

class FinancialSummaryServiceTest {
    @Test
    void legacySummaryProjectsTheAuthoritativeReport() {
        var reports = mock(FinancialReportService.class);
        var auth = new AuthenticatedUser("user-1", "user@example.invalid", 0L);
        var report = mock(Report.class);
        var summary = new FinancialSummaryData(10, 20, 25, 20, 10, 10, 50);
        when(reports.report(auth, 2026, 7)).thenReturn(report);
        when(report.summary()).thenReturn(summary);

        assertSame(summary, new FinancialSummaryService(reports).resolveForAuthenticatedUser(auth, 2026, 7));
    }
}
