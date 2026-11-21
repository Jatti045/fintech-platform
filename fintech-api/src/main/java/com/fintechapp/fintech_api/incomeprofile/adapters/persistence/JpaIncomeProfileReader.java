package com.fintechapp.fintech_api.incomeprofile.adapters.persistence;

import com.fintechapp.fintech_api.incomeprofile.application.MonthlyIncomeProfile.Profile;
import com.fintechapp.fintech_api.incomeprofile.application.ports.IncomeProfileReader;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.OptionalDouble;

public final class JpaIncomeProfileReader implements IncomeProfileReader {
  private final UserRepository users;
  private final UserMonthlyIncomeRepository baselines;
  private final TransactionRepository transactions;

  public JpaIncomeProfileReader(
      UserRepository users,
      UserMonthlyIncomeRepository baselines,
      TransactionRepository transactions) {
    this.users = users;
    this.baselines = baselines;
    this.transactions = transactions;
  }

  @Override
  public Optional<Profile> findProfile(String ownerId) {
    return users
        .findById(ownerId)
        .map(user ->
            new Profile(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getProfilePic(),
                user.getCurrency(),
                user.isSetupComplete(),
                user.getCreatedAt(),
                user.getUpdatedAt()));
  }

  @Override
  public OptionalDouble findExpectedIncome(String ownerId, Instant atOrBefore) {
    return baselines
        .findTopByUser_IdAndMonthStartLessThanEqualOrderByMonthStartDesc(ownerId, atOrBefore)
        .map(baseline -> OptionalDouble.of(baseline.getIncome()))
        .orElseGet(OptionalDouble::empty);
  }

  @Override
  public double sumActualIncome(String ownerId, Instant start, Instant endExclusive) {
    return transactions.sumAmountByUserAndTypeAndDateBetween(
        ownerId, TransactionType.INCOME, start, endExclusive);
  }
}
