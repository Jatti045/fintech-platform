package com.fintechapp.fintech_api.incomeupdate.infrastructure.configuration;

import com.fintechapp.fintech_api.incomeupdate.adapters.persistence.JpaIncomeBaselineStore;
import com.fintechapp.fintech_api.incomeupdate.application.UpdateIncomeBaseline;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;
import com.fintechapp.fintech_api.service.IncomeCalculationService;
import com.fintechapp.fintech_api.service.MonthlyIncomeService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class IncomeUpdateConfiguration {
  @Bean
  UpdateIncomeBaseline updateIncomeBaseline(
      UserRepository users,
      MonthlyIncomeService incomes,
      IncomeCalculationService calculations,
      FinancialCacheInvalidator caches) {
    return new UpdateIncomeBaseline(
        new JpaIncomeBaselineStore(users, incomes, calculations),
        caches::evictFinancialSummaryRegion);
  }
}
