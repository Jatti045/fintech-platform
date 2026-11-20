package com.fintechapp.fintech_api.reporting.infrastructure.configuration;

import com.fintechapp.fintech_api.reporting.adapters.persistence.JdbcFinancialFactsReader;
import com.fintechapp.fintech_api.reporting.application.GetFinancialReport;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportCalculator;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class FinancialReportingConfiguration {
  @Bean
  GetFinancialReport getFinancialReport(
      JdbcTemplate jdbc,
      UserRepository users,
      BudgetRepository budgets,
      UserMonthlyIncomeRepository incomes) {
    return new GetFinancialReport(
        new JdbcFinancialFactsReader(jdbc, users, budgets, incomes),
        new FinancialReportCalculator(),
        Clock.systemUTC());
  }
}
