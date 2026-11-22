package com.fintechapp.fintech_api.currencyupdate.infrastructure.configuration;

import com.fintechapp.fintech_api.currencyupdate.adapters.persistence.JpaCurrencyAccountStore;
import com.fintechapp.fintech_api.currencyupdate.application.ChangeAccountCurrency;
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
public class CurrencyUpdateConfiguration {
  @Bean
  ChangeAccountCurrency changeAccountCurrency(
      UserRepository users,
      TransactionRepository transactions,
      BudgetRepository budgets,
      MonthlyIncomeService incomes,
      IncomeCalculationService calculations,
      FinancialCacheInvalidator cacheInvalidator) {
    return new ChangeAccountCurrency(
        new JpaCurrencyAccountStore(users, transactions, budgets, incomes, calculations),
        cacheInvalidator::evictFinancialDataAfterCommit,
        Clock.systemUTC());
  }
}
