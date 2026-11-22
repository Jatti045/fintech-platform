package com.fintechapp.fintech_api.accountsetup.adapters.persistence;

import com.fintechapp.fintech_api.accountsetup.application.SetupProfile;
import com.fintechapp.fintech_api.accountsetup.application.ports.SetupAccountStore;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.IncomeCalculationService;
import com.fintechapp.fintech_api.service.MonthlyIncomeService;
import java.time.YearMonth;
import java.util.Optional;

public final class JpaSetupAccountStore implements SetupAccountStore {
  private final UserRepository users;
  private final TransactionRepository transactions;
  private final BudgetRepository budgets;
  private final MonthlyIncomeService incomes;
  private final IncomeCalculationService calculations;

  public JpaSetupAccountStore(
      UserRepository users,
      TransactionRepository transactions,
      BudgetRepository budgets,
      MonthlyIncomeService incomes,
      IncomeCalculationService calculations) {
    this.users = users;
    this.transactions = transactions;
    this.budgets = budgets;
    this.incomes = incomes;
    this.calculations = calculations;
  }

  @Override
  public Optional<LockedAccount> lock(String ownerId) {
    return users.findByIdForUpdate(ownerId).map(ManagedAccount::new);
  }

  private final class ManagedAccount implements LockedAccount {
    private final User user;

    private ManagedAccount(User user) {
      this.user = user;
    }

    @Override
    public boolean isComplete() {
      return user.isSetupComplete();
    }

    @Override
    public String currency() {
      return user.getCurrency();
    }

    @Override
    public boolean hasFinancialData() {
      return transactions.existsByUser_Id(user.getId())
          || budgets.existsByUser_Id(user.getId())
          || incomes.existsForUser(user.getId());
    }

    @Override
    public void changeCurrency(String currency) {
      user.setCurrency(currency);
    }

    @Override
    public void saveIncome(YearMonth month, double income) {
      incomes.upsertForMonth(user, month.getYear(), month.getMonthValue() - 1, income);
    }

    @Override
    public void markComplete() {
      // The locked entity remains managed by the endpoint transaction. JPA flushes this change.
      user.setSetupComplete(true);
    }

    @Override
    public SetupProfile profile(YearMonth month) {
      int year = month.getYear();
      int monthIndex = month.getMonthValue() - 1;
      double expected = calculations.resolveExpectedForMonth(user, year, monthIndex);
      double actual = calculations.resolveActualForMonth(user, year, monthIndex);
      return new SetupProfile(
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
