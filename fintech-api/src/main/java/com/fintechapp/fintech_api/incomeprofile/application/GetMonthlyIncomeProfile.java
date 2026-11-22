package com.fintechapp.fintech_api.incomeprofile.application;

import com.fintechapp.fintech_api.incomeprofile.application.ports.IncomeProfileReader;
import com.fintechapp.fintech_api.incomeprofile.domain.IncomeMonth;

public final class GetMonthlyIncomeProfile {
  private final IncomeProfileReader reader;

  public GetMonthlyIncomeProfile(IncomeProfileReader reader) {
    this.reader = reader;
  }

  public MonthlyIncomeProfile execute(String ownerId, String month, String year) {
    // Preserve missing-owner precedence over invalid values supplied by an authenticated caller.
    var profile = reader.findProfile(ownerId).orElseThrow(ProfileNotFound::new);
    var period = IncomeMonth.parse(month, year);
    var start = period.start();
    double expected = reader.findExpectedIncome(ownerId, start).orElse(0d);
    double actual = reader.sumActualIncome(ownerId, start, period.endExclusive());
    return new MonthlyIncomeProfile(profile, expected, actual);
  }

  public static final class ProfileNotFound extends RuntimeException {}
}
