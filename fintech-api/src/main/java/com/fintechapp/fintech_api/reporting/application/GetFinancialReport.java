package com.fintechapp.fintech_api.reporting.application;

import com.fintechapp.fintech_api.reporting.application.ports.FinancialFactsReader;
import com.fintechapp.fintech_api.reporting.domain.FinancialFacts.Actor;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportCalculator;
import com.fintechapp.fintech_api.reporting.domain.FinancialReportResult;
import java.time.Clock;
import java.time.YearMonth;

public final class GetFinancialReport {
  private final FinancialFactsReader reader;
  private final FinancialReportCalculator calculator;
  private final Clock clock;

  public GetFinancialReport(
      FinancialFactsReader reader, FinancialReportCalculator calculator, Clock clock) {
    this.reader = reader;
    this.calculator = calculator;
    this.clock = clock;
  }

  public FinancialReportResult execute(String ownerId, int year, int month) {
    if (ownerId == null) throw new UnknownActor();
    return forResolvedActor(reader.findActor(ownerId).orElseThrow(UnknownActor::new), year, month);
  }

  public FinancialReportResult forResolvedActor(Actor actor, int year, int month) {
    if (month < 0 || month > 11 || year < 1 || year > 9998) throw new InvalidPeriod();
    var generatedAt = clock.instant();
    var period = YearMonth.of(year, month + 1);
    return calculator.calculate(actor, period, generatedAt, reader.read(actor.id(), period));
  }

  public static final class UnknownActor extends RuntimeException {}

  public static final class InvalidPeriod extends RuntimeException {}
}
