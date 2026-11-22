package com.fintechapp.fintech_api.reporting;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fintechapp.fintech_api.reporting.application.GetFinancialReport;
import com.fintechapp.fintech_api.reporting.application.ports.FinancialFactsReader;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Actor;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Row;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportCalculator;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class FinancialReportPolicyTest {
  private static final Actor OWNER = new Actor("owner", "CAD");
  private static final Instant NOW = Instant.parse("2024-02-29T23:59:59Z");

  @Test
  void calculatorPreservesStableResidualTiesAndNegativeHalfCentRounding() {
    var facts =
        new FinancialFacts(
            List.of(expense(1, "zebra", "0.005", "0"), expense(2, "alpha", "0.005", "0")),
            100.005,
            true,
            List.of(),
            List.of(expense(31, "zebra", "0", "0.005")));
    var result =
        new FinancialReportCalculator().calculate(OWNER, YearMonth.of(2024, 1), NOW, facts);
    var report = result.report();
    assertEquals(NOW, report.generatedAt());
    assertEquals(100.01, report.summary().monthlyIncome());
    assertEquals(0.01, report.summary().netSpent());
    assertEquals(0.01, report.daily().get(0).netSpent());
    assertEquals(0, report.daily().get(1).netSpent());
    assertEquals("zebra", report.categories().get(0).category());
    assertEquals(0.01, report.categories().get(0).netSpent());
    assertEquals(2023, report.previousPeriod().year());
    assertEquals(11, report.previousPeriod().month());
    assertEquals(0, report.previousPeriod().netSpent());
    assertNull(report.previousPeriod().spendingChangePercentage());
    assertEquals(0, result.previousCategories().get(0).netSpent());
    assertEquals(-0.12, FinancialReportCalculator.percentage(799, 800));
  }

  @Test
  void useCaseResolvesOwnerThenReadsTheClockThenLoadsTheRequestedMonth() {
    var reader = mock(FinancialFactsReader.class);
    var clock = mock(Clock.class);
    var month = YearMonth.of(2024, 2);
    when(reader.findActor(OWNER.id())).thenReturn(Optional.of(OWNER));
    when(clock.instant()).thenReturn(NOW);
    when(reader.read(OWNER.id(), month))
        .thenReturn(new FinancialFacts(List.of(), 0, false, List.of(), List.of()));

    var report =
        new GetFinancialReport(reader, new FinancialReportCalculator(), clock)
            .execute(OWNER.id(), 2024, 1)
            .report();
    assertEquals(NOW, report.generatedAt());
    assertEquals(29, report.daily().size());
    assertEquals("CAD", report.currency());
    var calls = inOrder(reader, clock);
    calls.verify(reader).findActor(OWNER.id());
    calls.verify(clock).instant();
    calls.verify(reader).read(OWNER.id(), month);
    verifyNoMoreInteractions(reader, clock);
  }

  @Test
  void rejectsUnknownOwnersAndInvalidPeriodsBeforeLoadingFacts() {
    var reader = mock(FinancialFactsReader.class);
    when(reader.findActor(OWNER.id())).thenReturn(Optional.of(OWNER));
    var operation =
        new GetFinancialReport(
            reader, new FinancialReportCalculator(), Clock.fixed(NOW, ZoneOffset.UTC));
    assertThrows(GetFinancialReport.UnknownActor.class, () -> operation.execute(null, 2024, 1));
    assertThrows(
        GetFinancialReport.UnknownActor.class, () -> operation.execute("unknown", 2024, 1));
    assertThrows(
        GetFinancialReport.InvalidPeriod.class, () -> operation.execute(OWNER.id(), 2024, 12));
    verify(reader).findActor("unknown");
    verify(reader).findActor(OWNER.id());
    verifyNoMoreInteractions(reader);
  }

  private static Row expense(int day, String category, String gross, String credits) {
    return new Row(
        day, category, null, new BigDecimal(gross), new BigDecimal(credits), BigDecimal.ZERO, 1);
  }
}
