package com.fintechapp.fintech_api.accountsetup.application;

import com.fintechapp.fintech_api.accountsetup.application.ports.SetupAccountStore;
import com.fintechapp.fintech_api.accountsetup.domain.SetupSettings;
import com.fintechapp.fintech_api.shared.domain.CurrencyChange;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.function.Consumer;

public final class CompleteAccountSetup {
  private final SetupAccountStore accounts;
  private final Consumer<String> scheduleFinancialEviction;
  private final Clock utcClock;

  /** The eviction consumer must defer its effect until the enclosing transaction commits. */
  public CompleteAccountSetup(
      SetupAccountStore accounts, Consumer<String> scheduleFinancialEviction, Clock utcClock) {
    this.accounts = accounts;
    this.scheduleFinancialEviction = scheduleFinancialEviction;
    this.utcClock = utcClock;
  }

  public SetupProfile execute(String ownerId, BigDecimal income, String currency) {
    var account = accounts.lock(ownerId).orElseThrow(AccountNotFound::new);
    if (account.isComplete()) return account.profile(YearMonth.now(utcClock));

    var settings = SetupSettings.from(income, currency);
    switch (CurrencyChange.decide(
        account.currency(), settings.currency(), account::hasFinancialData)) {
      case BLOCKED -> throw new CurrencyChangeBlocked();
      case ALLOWED -> account.changeCurrency(settings.currency());
      case UNCHANGED -> {}
    }
    var period = YearMonth.now(utcClock);
    account.saveIncome(period, settings.monthlyIncome());
    account.markComplete();
    scheduleFinancialEviction.accept(ownerId);
    return account.profile(period);
  }

  public static final class AccountNotFound extends RuntimeException {}

  public static final class CurrencyChangeBlocked extends RuntimeException {}
}
