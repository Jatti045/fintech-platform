package com.fintechapp.fintech_api.service;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse.Category;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse.Report;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportCalculator;
import java.util.List;

/** Compatibility contract for summary and insight consumers during their later migrations. */
public interface FinancialReportService {
  Report report(AuthenticatedUser auth, int year, int month);

  MonthlyFacts facts(User user, int year, int month);

  record MonthlyFacts(Report report, List<Category> previousCategories) {}

  static Double percentage(double current, double previous) {
    return FinancialReportCalculator.percentage(current, previous);
  }
}
