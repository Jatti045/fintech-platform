package com.fintechapp.fintech_api.currencyupdate.application;

import com.fintechapp.fintech_api.currencyupdate.application.ports.CurrencyAccountStore;
import com.fintechapp.fintech_api.currencyupdate.domain.RequestedCurrency;
import com.fintechapp.fintech_api.shared.domain.CurrencyChange;
import java.time.Clock;
import java.time.YearMonth;
import java.util.function.Consumer;

public final class ChangeAccountCurrency {
  private final CurrencyAccountStore accounts;
  private final Consumer<String> scheduleFinancialEviction;
  private final Clock utcClock;

  /** The eviction consumer defers its effect until the enclosing transaction commits. */
  public ChangeAccountCurrency(
      CurrencyAccountStore accounts, Consumer<String> scheduleFinancialEviction, Clock utcClock) {
    this.accounts = accounts;
    this.scheduleFinancialEviction = scheduleFinancialEviction;
    this.utcClock = utcClock;
  }

  public CurrencyProfile execute(String ownerId, String requestedCurrency) {
    var account = accounts.lock(ownerId).orElseThrow(AccountNotFound::new);
    String code = RequestedCurrency.normalize(requestedCurrency);
    switch (CurrencyChange.decide(account.currency(), code, account::hasFinancialData)) {
      case BLOCKED -> throw new FinancialDataExists();
      case ALLOWED -> {
        account.saveCurrency(code);
        scheduleFinancialEviction.accept(ownerId);
      }
      case UNCHANGED -> {}
    }
    return account.profile(YearMonth.now(utcClock));
  }

  public static final class AccountNotFound extends RuntimeException {}

  public static final class FinancialDataExists extends RuntimeException {}
}
