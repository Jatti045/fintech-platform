package com.fintechapp.fintech_api.accountsetup.application.ports;

import com.fintechapp.fintech_api.accountsetup.application.SetupProfile;
import java.time.YearMonth;
import java.util.Optional;

public interface SetupAccountStore {
  /** The returned account may only be used within the transaction holding its owner lock. */
  Optional<LockedAccount> lock(String ownerId);

  interface LockedAccount {
    boolean isComplete();

    String currency();

    boolean hasFinancialData();

    void changeCurrency(String currency);

    void saveIncome(YearMonth month, double income);

    void markComplete();

    SetupProfile profile(YearMonth month);
  }
}
