package com.fintechapp.fintech_api.incomeprofile;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fintechapp.fintech_api.incomeprofile.application.GetMonthlyIncomeProfile;
import com.fintechapp.fintech_api.incomeprofile.application.MonthlyIncomeProfile.Profile;
import com.fintechapp.fintech_api.incomeprofile.application.ports.IncomeProfileReader;
import com.fintechapp.fintech_api.incomeprofile.domain.IncomeMonth;
import java.time.Instant;
import java.util.Optional;
import java.util.OptionalDouble;
import org.junit.jupiter.api.Test;

class MonthlyIncomeProfileTest {
  private static final Instant FEBRUARY = Instant.parse("2024-02-01T00:00:00Z");
  private static final Instant MARCH = Instant.parse("2024-03-01T00:00:00Z");
  private static final Profile OWNER =
      new Profile("owner", "name", "owner@example.com", null, "CAD", true, FEBRUARY, FEBRUARY);

  @Test
  void validatesZeroBasedPeriodsAndBuildsUtcWindows() {
    var february = IncomeMonth.parse(" 01 ", "+2024");
    assertEquals(FEBRUARY, february.start());
    assertEquals(MARCH, february.endExclusive());
    assertEquals(Instant.parse("2024-01-01T00:00:00Z"), new IncomeMonth(2023, 11).endExclusive());
    assertThrows(IncomeMonth.InvalidPeriod.class, () -> new IncomeMonth(2024, 12));
    assertThrows(IncomeMonth.InvalidPeriod.class, () -> IncomeMonth.parse("1.0", "2024"));
  }

  @Test
  void preservesSeparateIncomeAmountsWithoutChoosingAReportingBasis() {
    var reader = mock(IncomeProfileReader.class);
    when(reader.findProfile("owner")).thenReturn(Optional.of(OWNER));
    when(reader.findExpectedIncome("owner", FEBRUARY)).thenReturn(OptionalDouble.of(325.125));
    when(reader.sumActualIncome("owner", FEBRUARY, MARCH)).thenReturn(125.375);
    var result = new GetMonthlyIncomeProfile(reader).execute("owner", "1", "2024");
    assertEquals(OWNER, result.profile());
    assertEquals(325.125, result.expectedIncome());
    assertEquals(125.375, result.actualIncome());
    var queries = inOrder(reader);
    queries.verify(reader).findProfile("owner");
    queries.verify(reader).findExpectedIncome("owner", FEBRUARY);
    queries.verify(reader).sumActualIncome("owner", FEBRUARY, MARCH);
    verifyNoMoreInteractions(reader);
  }

  @Test
  void mapsAbsentAndZeroBaselinesToZeroWithoutDiscardingActualIncome() {
    var reader = mock(IncomeProfileReader.class);
    when(reader.findProfile("owner")).thenReturn(Optional.of(OWNER));
    when(reader.findExpectedIncome("owner", FEBRUARY))
        .thenReturn(OptionalDouble.empty(), OptionalDouble.of(0));
    when(reader.sumActualIncome("owner", FEBRUARY, MARCH)).thenReturn(125.375);
    var operation = new GetMonthlyIncomeProfile(reader);
    for (int i = 0; i < 2; i++) {
      var result = operation.execute("owner", "1", "2024");
      assertEquals(0, result.expectedIncome());
      assertEquals(125.375, result.actualIncome());
    }
  }

  @Test
  void rejectsMissingOwnersAndInvalidPeriodsBeforeIncomeQueries() {
    var reader = mock(IncomeProfileReader.class);
    when(reader.findProfile("owner")).thenReturn(Optional.of(OWNER));
    var operation = new GetMonthlyIncomeProfile(reader);
    assertThrows(
        GetMonthlyIncomeProfile.ProfileNotFound.class,
        () -> operation.execute("missing", "bad", "2024"));
    assertThrows(IncomeMonth.InvalidPeriod.class, () -> operation.execute("owner", "bad", "2024"));
    verify(reader).findProfile("missing");
    verify(reader).findProfile("owner");
    verifyNoMoreInteractions(reader);
  }
}
