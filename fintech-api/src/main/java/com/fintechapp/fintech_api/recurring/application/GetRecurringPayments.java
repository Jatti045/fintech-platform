package com.fintechapp.fintech_api.recurring.application;

import com.fintechapp.fintech_api.recurring.domain.RecurringPayment;
import com.fintechapp.fintech_api.recurring.domain.RecurringPaymentDetector;
import com.fintechapp.fintech_api.recurring.domain.repositories.ExpenseHistory;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

public final class GetRecurringPayments {
  private final ExpenseHistory history;
  private final RecurringPaymentDetector detector;
  private final Clock clock;

  public GetRecurringPayments(
      ExpenseHistory history, RecurringPaymentDetector detector, Clock clock) {
    this.history = history;
    this.detector = detector;
    this.clock = clock;
  }

  public List<RecurringPayment> execute(String userId) {
    if (userId == null || userId.isBlank()) {
      throw new IllegalStateException("Authenticated user is required");
    }
    var now = clock.instant();
    return detector.detect(
        history.findSince(
            userId, now.minus(Duration.ofDays(RecurringPaymentDetector.HISTORY_DAYS))),
        now);
  }
}
