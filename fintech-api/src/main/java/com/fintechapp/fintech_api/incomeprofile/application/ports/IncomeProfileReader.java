package com.fintechapp.fintech_api.incomeprofile.application.ports;

import com.fintechapp.fintech_api.incomeprofile.application.MonthlyIncomeProfile.Profile;
import java.time.Instant;
import java.util.Optional;
import java.util.OptionalDouble;

public interface IncomeProfileReader {
  Optional<Profile> findProfile(String ownerId);

  OptionalDouble findExpectedIncome(String ownerId, Instant atOrBefore);

  double sumActualIncome(String ownerId, Instant start, Instant endExclusive);
}
