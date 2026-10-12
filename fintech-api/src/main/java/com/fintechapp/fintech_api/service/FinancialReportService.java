package com.fintechapp.fintech_api.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse.*;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;

@Service
public class FinancialReportService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final BudgetRepository budgets;
    private final UserMonthlyIncomeRepository incomes;
    private final FinancialSummaryService summary;
    private final IncomeCalculationService income;

    public FinancialReportService(JdbcTemplate jdbc, UserRepository users, BudgetRepository budgets,
            UserMonthlyIncomeRepository incomes, FinancialSummaryService summary, IncomeCalculationService income) {
        this.jdbc = jdbc; this.users = users; this.budgets = budgets; this.incomes = incomes;
        this.summary = summary; this.income = income;
    }

    private static class Amounts {
        BigDecimal gross = BigDecimal.ZERO, credits = BigDecimal.ZERO;
        void add(BigDecimal g, BigDecimal c) { gross = gross.add(g); credits = credits.add(c); }
        double net() { return gross.subtract(credits).doubleValue(); }
    }
    private record Row(int day, String category, String budgetId, BigDecimal gross, BigDecimal credits,
            BigDecimal income, long count) {}

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Report report(AuthenticatedUser auth, int year, int month) {
        Instant generatedAt = Instant.now();
        Instant from = summary.monthStart(year, month);
        if (auth == null || auth.userId() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        var user = users.findById(auth.userId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        YearMonth period = YearMonth.of(year, month + 1);
        Instant to = start(period.plusMonths(1));
        List<Row> rows = rows(user.getId(), from, to);
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
                categories.computeIfAbsent(row.category(), k -> new Amounts()).add(row.gross(), row.credits());
                usage.computeIfAbsent(row.budgetId(), k -> new Amounts()).add(row.gross(), row.credits());
            }
            actual = actual.add(row.income()); count += row.count();
        }
        BigDecimal net = money(total.gross.subtract(total.credits));
        total.gross = money(total.gross); total.credits = total.gross.subtract(net);
        reconcile(daily, total); reconcile(categories, total); reconcile(usage, total);
        double actualIncome = money(actual).doubleValue();
        double expected = round(income.resolveExpectedForMonth(user, year, month));
        boolean configured = incomes.findTopByUser_IdAndMonthStartLessThanEqualOrderByMonthStartDesc(user.getId(), from).isPresent();
        double effective = IncomeCalculationService.effectiveIncome(actualIncome, expected);
        String basis = actualIncome > 0 ? "ACTUAL" : configured ? "EXPECTED" : "UNCONFIGURED";
        var totals = new FinancialSummaryData(total.net(), effective, expected, actualIncome, total.net(),
                round(effective - total.net()), effective > 0 ? round(total.net() / effective * 100) : 0);
        List<BudgetUsage> budgetRows = budgets.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(user.getId(), from, to)
                .stream().map(b -> {
                    Amounts a = usage.getOrDefault(b.getId(), new Amounts());
                    double spent = a.net();
                    return new BudgetUsage(b.getId(), b.getCategory(), b.getLimit(), spent, round(b.getLimit() - spent),
                            b.getLimit() > 0 ? round(spent / b.getLimit() * 100) : null, b.isAutoCreated(), user.getId(), b.getDate(), b.getCreatedAt(), b.getUpdatedAt());
                }).toList();
        YearMonth previous = period.minusMonths(1);
        List<Row> previousRows = rows(user.getId(), start(previous), from);
        BigDecimal previousIncome = BigDecimal.ZERO, previousGross = BigDecimal.ZERO, previousCredits = BigDecimal.ZERO;
        for (Row r : previousRows) {
            previousIncome = previousIncome.add(r.income()); previousGross = previousGross.add(r.gross()); previousCredits = previousCredits.add(r.credits());
        }
        double pi = money(previousIncome).doubleValue(), ps = money(previousGross.subtract(previousCredits)).doubleValue();
        var comparison = new Comparison(previous.getYear(), previous.getMonthValue() - 1, pi, ps,
                round(actualIncome - pi), round(total.net() - ps), percentage(actualIncome, pi), percentage(total.net(), ps));
        return new Report(year, month, user.getCurrency(), generatedAt, basis, configured, count, totals,
                total.gross.doubleValue(), total.credits.doubleValue(),
                daily.entrySet().stream().map(e -> new Daily(e.getKey(), e.getValue().gross.doubleValue(), e.getValue().credits.doubleValue(), e.getValue().net())).toList(),
                categories.entrySet().stream().map(e -> new Category(e.getKey(), e.getValue().gross.doubleValue(), e.getValue().credits.doubleValue(), e.getValue().net())).toList(),
                budgetRows, comparison);
    }

    private List<Row> rows(String userId, Instant from, Instant to) {
        return jdbc.query("""
            SELECT EXTRACT(DAY FROM transaction_date AT TIME ZONE 'UTC') AS day,
                   LOWER(TRIM(category)) AS category, budget_id,
                   COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND amount > 0 THEN amount::numeric ELSE 0 END), 0) AS gross,
                   COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND amount < 0 THEN -amount::numeric ELSE 0 END), 0) AS credits,
                   COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount::numeric ELSE 0 END), 0) AS income,
                   COUNT(*) AS count
            FROM transactions WHERE user_id = ? AND transaction_date >= ? AND transaction_date < ? AND is_transfer = false
            GROUP BY day, LOWER(TRIM(category)), budget_id ORDER BY day, category, budget_id
            """, (rs, n) -> new Row(rs.getInt("day"), rs.getString("category"), rs.getString("budget_id"),
                    rs.getBigDecimal("gross"), rs.getBigDecimal("credits"), rs.getBigDecimal("income"), rs.getLong("count")),
                userId, java.sql.Timestamp.from(from), java.sql.Timestamp.from(to));
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
            if (gross) a.gross = rounded; else a.credits = rounded;
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
    private static Instant start(YearMonth period) { return period.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC); }
    private static BigDecimal money(BigDecimal value) { return value.movePointRight(2).add(new BigDecimal("0.5")).setScale(0, RoundingMode.FLOOR).movePointLeft(2); }
    private static double round(double value) { return money(BigDecimal.valueOf(value)).doubleValue(); }
    private static Double percentage(double current, double previous) { return previous > 0 ? round((current - previous) / previous * 100) : null; }
}
