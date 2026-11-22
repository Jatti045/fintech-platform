package com.fintechapp.fintech_api.accountsetup.infrastructure.configuration;

import com.fintechapp.fintech_api.accountsetup.adapters.persistence.JpaSetupAccountStore;
import com.fintechapp.fintech_api.accountsetup.application.CompleteAccountSetup;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;
import com.fintechapp.fintech_api.service.IncomeCalculationService;
import com.fintechapp.fintech_api.service.MonthlyIncomeService;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AccountSetupConfiguration {
  @Bean
  CompleteAccountSetup completeAccountSetup(
      UserRepository users,
      TransactionRepository transactions,
      BudgetRepository budgets,
      MonthlyIncomeService incomes,
      IncomeCalculationService calculations,
      FinancialCacheInvalidator caches) {
    return new CompleteAccountSetup(
        new JpaSetupAccountStore(users, transactions, budgets, incomes, calculations),
        caches::evictFinancialDataAfterCommit,
        Clock.systemUTC());
  }
}
