package com.fintechapp.fintech_api.currencyupdate.application.ports;

import com.fintechapp.fintech_api.currencyupdate.application.CurrencyProfile;
import java.time.YearMonth;
import java.util.Optional;

public interface CurrencyAccountStore {
  /** The account is usable only within the transaction holding its owner lock. */
  Optional<LockedAccount> lock(String ownerId);

  interface LockedAccount {
    String currency();

    boolean hasFinancialData();

    void saveCurrency(String currency);

    CurrencyProfile profile(YearMonth month);
  }
}
