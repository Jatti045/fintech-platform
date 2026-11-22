package com.fintechapp.fintech_api.currencyupdate.adapters.persistence;

import com.fintechapp.fintech_api.currencyupdate.application.CurrencyProfile;
import com.fintechapp.fintech_api.currencyupdate.application.ports.CurrencyAccountStore;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.IncomeCalculationService;
import com.fintechapp.fintech_api.service.MonthlyIncomeService;
import java.time.YearMonth;
import java.util.Optional;

public final class JpaCurrencyAccountStore implements CurrencyAccountStore {
  private final UserRepository users;
  private final TransactionRepository transactions;
  private final BudgetRepository budgets;
  private final MonthlyIncomeService incomes;
  private final IncomeCalculationService calculations;

  public JpaCurrencyAccountStore(
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
    private User user;

    private ManagedAccount(User user) {
      this.user = user;
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
    public void saveCurrency(String currency) {
      user.setCurrency(currency);
      user = users.save(user);
    }

    @Override
    public CurrencyProfile profile(YearMonth month) {
      int year = month.getYear();
      int monthIndex = month.getMonthValue() - 1;
      double expected = calculations.resolveExpectedForMonth(user, year, monthIndex);
      double actual = calculations.resolveActualForMonth(user, year, monthIndex);
      return new CurrencyProfile(
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
