package com.fintechapp.fintech_api.reporting.domain;

import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Actor;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Row;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportResult.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FinancialReportCalculator {
  private static class Amounts {
    BigDecimal gross = BigDecimal.ZERO, credits = BigDecimal.ZERO;

    void add(BigDecimal g, BigDecimal c) {
      gross = gross.add(g);
      credits = credits.add(c);
    }

    double net() {
      return gross.subtract(credits).doubleValue();
    }
  }

  public FinancialReportResult calculate(
      Actor actor, YearMonth period, Instant generatedAt, FinancialFacts facts) {
    int year = period.getYear();
    int month = period.getMonthValue() - 1;
    List<Row> rows = facts.current();
    Map<Integer, Amounts> daily = new LinkedHashMap<>();
    for (int day = 1; day <= period.lengthOfMonth(); day++) daily.put(day, new Amounts());
    Map<String, Amounts> categories = new LinkedHashMap<>(), usage = new LinkedHashMap<>();
    Amounts total = new Amounts();
    BigDecimal actual = BigDecimal.ZERO;
    long count = 0;
    for (Row row : rows) {
      total.add(row.gross(), row.credits());
      daily.get(row.day()).add(row.gross(), row.credits());
      if (row.gross().signum() != 0 || row.credits().signum() != 0) {
        categories
            .computeIfAbsent(row.category(), k -> new Amounts())
            .add(row.gross(), row.credits());
        usage.computeIfAbsent(row.budgetId(), k -> new Amounts()).add(row.gross(), row.credits());
      }
      actual = actual.add(row.income());
      count += row.count();
    }
    BigDecimal net = money(total.gross.subtract(total.credits));
    total.gross = money(total.gross);
    total.credits = total.gross.subtract(net);
    reconcile(daily, total);
    reconcile(categories, total);
    reconcile(usage, total);
    double actualIncome = money(actual).doubleValue();
    double expected = round(facts.expectedIncome());
    boolean configured = facts.expectedIncomeConfigured();
    double effective = actualIncome > 0 ? actualIncome : expected;
    String basis = actualIncome > 0 ? "ACTUAL" : configured ? "EXPECTED" : "UNCONFIGURED";
    var totals =
        new Totals(
            total.net(),
            effective,
            expected,
            actualIncome,
            total.net(),
            round(effective - total.net()),
            effective > 0 ? round(total.net() / effective * 100) : 0);
    List<BudgetUsage> budgetRows =
        facts.budgets().stream()
            .map(b -> {
              Amounts a = usage.getOrDefault(b.id(), new Amounts());
              double spent = a.net();
              return new BudgetUsage(
                  b.id(),
                  b.category(),
                  b.limit(),
                  spent,
                  round(b.limit() - spent),
                  b.limit() > 0 ? round(spent / b.limit() * 100) : null,
                  b.autoCreated(),
                  actor.id(),
                  b.date(),
                  b.createdAt(),
                  b.updatedAt());
            })
            .toList();
    YearMonth previous = period.minusMonths(1);
    List<Row> previousRows = facts.previous();
    BigDecimal previousIncome = BigDecimal.ZERO,
        previousGross = BigDecimal.ZERO,
        previousCredits = BigDecimal.ZERO;
    Map<String, Amounts> previousCategories = new LinkedHashMap<>();
    for (Row r : previousRows) {
      previousIncome = previousIncome.add(r.income());
      previousGross = previousGross.add(r.gross());
      previousCredits = previousCredits.add(r.credits());
      if (r.gross().signum() != 0 || r.credits().signum() != 0) {
        previousCategories
            .computeIfAbsent(r.category(), key -> new Amounts())
            .add(r.gross(), r.credits());
      }
    }
    double pi = money(previousIncome).doubleValue(),
        ps = money(previousGross.subtract(previousCredits)).doubleValue();
    var comparison =
        new Comparison(
            previous.getYear(),
            previous.getMonthValue() - 1,
            pi,
            ps,
            round(actualIncome - pi),
            round(total.net() - ps),
            percentage(actualIncome, pi),
            percentage(total.net(), ps));
    Amounts previousTotal = new Amounts();
    previousTotal.gross = money(previousGross);
    previousTotal.credits =
        previousTotal.gross.subtract(money(previousGross.subtract(previousCredits)));
    reconcile(previousCategories, previousTotal);
    var report =
        new Report(
            year,
            month,
            actor.currency(),
            generatedAt,
            basis,
            configured,
            count,
            totals,
            total.gross.doubleValue(),
            total.credits.doubleValue(),
            daily.entrySet().stream()
                .map(e ->
                    new Daily(
                        e.getKey(),
                        e.getValue().gross.doubleValue(),
                        e.getValue().credits.doubleValue(),
                        e.getValue().net()))
                .toList(),
            categoryFacts(categories),
            budgetRows,
            comparison);
    return new FinancialReportResult(report, categoryFacts(previousCategories));
  }

  private static List<Category> categoryFacts(Map<String, Amounts> categories) {
    return categories.entrySet().stream()
        .map(e ->
            new Category(
                e.getKey(),
                e.getValue().gross.doubleValue(),
                e.getValue().credits.doubleValue(),
                e.getValue().net()))
        .toList();
  }

  // Allocate any sub-cent rounding residual deterministically so breakdowns reconcile.
  private static <K> void reconcile(Map<K, Amounts> buckets, Amounts total) {
    if (buckets.isEmpty()) return;
    allocate(new ArrayList<>(buckets.values()), total.gross, true);
    allocate(new ArrayList<>(buckets.values()), total.credits, false);
  }

  private static void allocate(List<Amounts> buckets, BigDecimal target, boolean gross) {
    Map<Amounts, BigDecimal> residuals = new java.util.IdentityHashMap<>();
    BigDecimal sum = BigDecimal.ZERO;
    for (Amounts a : buckets) {
      BigDecimal raw = gross ? a.gross : a.credits;
      BigDecimal rounded = raw.setScale(2, RoundingMode.DOWN);
      residuals.put(a, raw.subtract(rounded));
      if (gross) a.gross = rounded;
      else a.credits = rounded;
      sum = sum.add(rounded);
    }
    buckets.sort((a, b) -> residuals.get(b).compareTo(residuals.get(a)));
    int cents = target.subtract(sum).movePointRight(2).intValueExact();
    for (int i = 0; i < cents; i++) {
      Amounts a = buckets.get(i % buckets.size());
      if (gross) a.gross = a.gross.add(new BigDecimal("0.01"));
      else a.credits = a.credits.add(new BigDecimal("0.01"));
    }
  }

  private static BigDecimal money(BigDecimal value) {
    return value
        .movePointRight(2)
        .add(new BigDecimal("0.5"))
        .setScale(0, RoundingMode.FLOOR)
        .movePointLeft(2);
  }

  private static double round(double value) {
    return money(BigDecimal.valueOf(value)).doubleValue();
  }

  public static Double percentage(double current, double previous) {
    return previous > 0 ? round((current - previous) / previous * 100) : null;
  }
}
