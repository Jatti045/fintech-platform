package com.fintechapp.fintech_api.reporting.adapters.persistence;

import com.fintechapp.fintech_api.model.UserMonthlyIncome;
import com.fintechapp.fintech_api.reporting.application.ports.FinancialFactsReader;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.*;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;

public final class JdbcFinancialFactsReader implements FinancialFactsReader {
  private final JdbcTemplate jdbc;
  private final UserRepository users;
  private final BudgetRepository budgets;
  private final UserMonthlyIncomeRepository incomes;

  public JdbcFinancialFactsReader(
      JdbcTemplate jdbc,
      UserRepository users,
      BudgetRepository budgets,
      UserMonthlyIncomeRepository incomes) {
    this.jdbc = jdbc;
    this.users = users;
    this.budgets = budgets;
    this.incomes = incomes;
  }

  @Override
  public Optional<Actor> findActor(String ownerId) {
    return users.findById(ownerId).map(user -> new Actor(user.getId(), user.getCurrency()));
  }

  @Override
  public FinancialFacts read(String ownerId, YearMonth period) {
    Instant from = start(period);
    Instant to = start(period.plusMonths(1));
    var current = rows(ownerId, from, to);
    var expected =
        incomes
            .findTopByUser_IdAndMonthStartLessThanEqualOrderByMonthStartDesc(ownerId, from)
            .map(UserMonthlyIncome::getIncome)
            .orElse(0d);
    var configured =
        incomes
            .findTopByUser_IdAndMonthStartLessThanEqualOrderByMonthStartDesc(ownerId, from)
            .isPresent();
    var budgetFacts =
        budgets
            .findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(ownerId, from, to)
            .stream()
            .map(b ->
                new Budget(
                    b.getId(),
                    b.getCategory(),
                    b.getLimit(),
                    b.isAutoCreated(),
                    b.getDate(),
                    b.getCreatedAt(),
                    b.getUpdatedAt()))
            .toList();
    return new FinancialFacts(
        current,
        expected,
        configured,
        budgetFacts,
        rows(ownerId, start(period.minusMonths(1)), from));
  }

  private static Instant start(YearMonth period) {
    return period.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
  }

  private List<Row> rows(String userId, Instant from, Instant to) {
    return jdbc.query(
        """
        SELECT EXTRACT(DAY FROM transaction_date AT TIME ZONE 'UTC') AS day,
               LOWER(TRIM(category)) AS category, budget_id,
               COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND amount > 0 THEN amount::numeric ELSE 0 END), 0) AS gross,
               COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND amount < 0 THEN -amount::numeric ELSE 0 END), 0) AS credits,
               COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount::numeric ELSE 0 END), 0) AS income,
               COUNT(*) AS count
        FROM transactions WHERE user_id = ? AND transaction_date >= ? AND transaction_date < ? AND is_transfer = false
        GROUP BY day, LOWER(TRIM(category)), budget_id ORDER BY day, category, budget_id
        """,
        (rs, n) ->
            new Row(
                rs.getInt("day"),
                rs.getString("category"),
                rs.getString("budget_id"),
                rs.getBigDecimal("gross"),
                rs.getBigDecimal("credits"),
                rs.getBigDecimal("income"),
                rs.getLong("count")),
        userId,
        java.sql.Timestamp.from(from),
        java.sql.Timestamp.from(to));
  }
}
