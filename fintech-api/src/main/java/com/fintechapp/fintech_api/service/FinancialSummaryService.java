package com.fintechapp.fintech_api.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.fintechapp.fintech_api.config.CacheConfig;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.model.User;

/** Cached compatibility projection of the authoritative monthly report. */
@Service
public class FinancialSummaryService {

    private final FinancialReportService reports;

    public FinancialSummaryService(FinancialReportService reports) {
        this.reports = reports;
    }

    /**
     * Resolves the authenticated user and computes the month summary.
     *
     * <p>Cached per user/month (Redis, TTL 10 min). Eviction is handled by
     * {@link FinancialCacheInvalidator} on every financial mutation.
     *
     * @param month zero-based month index (0 = January)
     */
    @Cacheable(cacheNames = CacheConfig.FINANCIAL_SUMMARY_CACHE,
            key = "#authenticatedUser?.userId() + ':' + #year + ':' + #month")
    public FinancialSummaryData resolveForAuthenticatedUser(
            AuthenticatedUser authenticatedUser,
            int year,
            int month) {
        return reports.report(authenticatedUser, year, month).summary();
    }

    public FinancialSummaryData resolveForMonth(User user, int year, int month) {
        return reports.facts(user, year, month).report().summary();
    }
}
