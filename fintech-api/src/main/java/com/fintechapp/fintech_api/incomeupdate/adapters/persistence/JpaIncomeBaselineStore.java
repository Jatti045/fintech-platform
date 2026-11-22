package com.fintechapp.fintech_api.incomeupdate.adapters.persistence;

import com.fintechapp.fintech_api.incomeupdate.application.IncomeUpdateProfile;
import com.fintechapp.fintech_api.incomeupdate.application.ports.IncomeBaselineStore;
import com.fintechapp.fintech_api.incomeupdate.domain.IncomeBaselineChange;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.IncomeCalculationService;
import com.fintechapp.fintech_api.service.MonthlyIncomeService;
import java.time.YearMonth;
import java.util.Optional;

public final class JpaIncomeBaselineStore implements IncomeBaselineStore {
  private final UserRepository users;
  private final MonthlyIncomeService incomes;
  private final IncomeCalculationService calculations;

  public JpaIncomeBaselineStore(
      UserRepository users, MonthlyIncomeService incomes, IncomeCalculationService calculations) {
    this.users = users;
    this.incomes = incomes;
    this.calculations = calculations;
  }

  @Override
  public Optional<LockedOwner> lock(String ownerId) {
    return users.findByIdForUpdate(ownerId).map(ManagedOwner::new);
  }

  private final class ManagedOwner implements LockedOwner {
    private final User user;

    private ManagedOwner(User user) {
      this.user = user;
    }

    @Override
    public void upsert(IncomeBaselineChange change) {
      int year = change.period().getYear();
      int month = change.period().getMonthValue() - 1;
      // The existing upsert joins this transaction and reacquires the same owner lock.
      incomes.upsertForMonth(user, year, month, change.amount());
    }

    @Override
    public IncomeUpdateProfile profile(YearMonth period) {
      int year = period.getYear();
      int month = period.getMonthValue() - 1;
      double expected = calculations.resolveExpectedForMonth(user, year, month);
      double actual = calculations.resolveActualForMonth(user, year, month);
      return new IncomeUpdateProfile(
          user.getId(),
          user.getUsername(),
          user.getEmail(),
          user.getProfilePic(),
          user.getCurrency(),
          user.isSetupComplete(),
          expected,
          actual,
          user.getCreatedAt(),
          user.getUpdatedAt());
    }
  }
}
