package com.fintechapp.fintech_api.recurring.infrastructure.configuration;

import com.fintechapp.fintech_api.recurring.adapters.persistence.JpaExpenseHistory;
import com.fintechapp.fintech_api.recurring.application.GetRecurringPayments;
import com.fintechapp.fintech_api.recurring.domain.RecurringPaymentDetector;
import com.fintechapp.fintech_api.recurring.infrastructure.cache.CachedRecurringPayments;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class RecurringPaymentsConfiguration {
  @Bean
  CachedRecurringPayments cachedRecurringPayments(TransactionRepository transactions) {
    return new CachedRecurringPayments(
        new GetRecurringPayments(
            new JpaExpenseHistory(transactions),
            new RecurringPaymentDetector(),
            Clock.systemUTC()));
  }
}
