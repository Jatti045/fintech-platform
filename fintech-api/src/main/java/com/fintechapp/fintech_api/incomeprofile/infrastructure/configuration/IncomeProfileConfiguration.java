package com.fintechapp.fintech_api.incomeprofile.infrastructure.configuration;

import com.fintechapp.fintech_api.incomeprofile.adapters.persistence.JpaIncomeProfileReader;
import com.fintechapp.fintech_api.incomeprofile.application.GetMonthlyIncomeProfile;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class IncomeProfileConfiguration {
  @Bean
  GetMonthlyIncomeProfile getMonthlyIncomeProfile(
      UserRepository users,
      UserMonthlyIncomeRepository baselines,
      TransactionRepository transactions) {
    return new GetMonthlyIncomeProfile(new JpaIncomeProfileReader(users, baselines, transactions));
  }
}
