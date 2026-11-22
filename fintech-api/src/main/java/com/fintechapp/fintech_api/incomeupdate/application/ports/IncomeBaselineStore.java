package com.fintechapp.fintech_api.incomeupdate.application.ports;

import com.fintechapp.fintech_api.incomeupdate.application.IncomeUpdateProfile;
import com.fintechapp.fintech_api.incomeupdate.domain.IncomeBaselineChange;
import java.time.YearMonth;
import java.util.Optional;

public interface IncomeBaselineStore {
  /** The returned account is usable only within the transaction holding the owner lock. */
  Optional<LockedOwner> lock(String ownerId);

  interface LockedOwner {
    void upsert(IncomeBaselineChange change);

    IncomeUpdateProfile profile(YearMonth period);
  }
}
