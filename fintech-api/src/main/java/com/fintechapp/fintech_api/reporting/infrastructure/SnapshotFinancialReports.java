package com.fintechapp.fintech_api.reporting.infrastructure;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse.*;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.reporting.application.GetFinancialReport;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Actor;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportResult;
import com.fintechapp.fintech_api.service.FinancialReportService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SnapshotFinancialReports implements FinancialReportService {
  private final GetFinancialReport operation;

  public SnapshotFinancialReports(GetFinancialReport operation) {
    this.operation = operation;
  }

  @Override
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Report report(AuthenticatedUser auth, int year, int month) {
    try {
      return map(operation.execute(auth == null ? null : auth.userId(), year, month)).report();
    } catch (GetFinancialReport.UnknownActor e) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    } catch (GetFinancialReport.InvalidPeriod e) {
      throw invalidPeriod();
    }
  }

  @Override
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public MonthlyFacts facts(User user, int year, int month) {
    try {
      return map(
          operation.forResolvedActor(new Actor(user.getId(), user.getCurrency()), year, month));
    } catch (GetFinancialReport.InvalidPeriod e) {
      throw invalidPeriod();
    }
  }

  private ResponseStatusException invalidPeriod() {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
  }

  private MonthlyFacts map(FinancialReportResult result) {
    var report = result.report();
    var totals = report.summary();
    var previous = report.previousPeriod();
    return new MonthlyFacts(
        new Report(
            report.year(),
            report.month(),
            report.currency(),
            report.generatedAt(),
            report.incomeBasis(),
            report.expectedIncomeConfigured(),
            report.transactionCount(),
            new FinancialSummaryData(
                totals.totalAmount(),
                totals.monthlyIncome(),
                totals.expectedIncome(),
                totals.actualIncome(),
                totals.netSpent(),
                totals.netRemaining(),
                totals.spentPercentageOfIncome()),
            report.grossExpenses(),
            report.expenseCredits(),
            report.daily().stream()
                .map(d -> new Daily(d.day(), d.grossExpenses(), d.expenseCredits(), d.netSpent()))
                .toList(),
            categoryFacts(report.categories()),
            report.budgets().stream()
                .map(b ->
                    new BudgetUsage(
                        b.id(),
                        b.category(),
                        b.limit(),
                        b.spent(),
                        b.remaining(),
                        b.utilizationPercentage(),
                        b.autoCreated(),
                        b.userId(),
                        b.date(),
                        b.createdAt(),
                        b.updatedAt()))
                .toList(),
            new Comparison(
                previous.year(),
                previous.month(),
                previous.actualIncome(),
                previous.netSpent(),
                previous.actualIncomeChange(),
                previous.netSpentChange(),
                previous.incomeChangePercentage(),
                previous.spendingChangePercentage())),
        categoryFacts(result.previousCategories()));
  }

  private static List<Category> categoryFacts(List<FinancialReportResult.Category> categories) {
    return categories.stream()
        .map(c -> new Category(c.category(), c.grossExpenses(), c.expenseCredits(), c.netSpent()))
        .toList();
  }
}
