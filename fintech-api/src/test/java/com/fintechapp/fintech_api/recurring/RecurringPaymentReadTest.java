package com.fintechapp.fintech_api.recurring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.recurring.adapters.persistence.JpaExpenseHistory;
import com.fintechapp.fintech_api.recurring.application.GetRecurringPayments;
import com.fintechapp.fintech_api.recurring.domain.RecurringPaymentDetector;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class RecurringPaymentReadTest {
  private final TransactionRepository transactions = mock(TransactionRepository.class);
  private final GetRecurringPayments read =
      new GetRecurringPayments(
          new JpaExpenseHistory(transactions),
          new RecurringPaymentDetector(),
          Clock.fixed(Instant.parse("2024-02-29T00:00:00Z"), ZoneOffset.UTC));

  @Test
  void readsTheOwnerExpenseHistoryWithOneQueryAtTheInclusiveUtcCutoff() {
    var cutoff = Instant.parse("2023-03-01T00:00:00Z");
    when(transactions.findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(
            "owner", TransactionType.EXPENSE, cutoff))
        .thenReturn(List.of());

    assertTrue(read.execute("owner").isEmpty());
    verify(transactions)
        .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(
            "owner", TransactionType.EXPENSE, cutoff);
    verifyNoMoreInteractions(transactions);
  }

  @Test
  void missingActorFailsBeforeQueryingHistory() {
    for (String actor : new String[] {null, "", "\t "}) {
      var failure = assertThrows(IllegalStateException.class, () -> read.execute(actor));
      assertEquals("Authenticated user is required", failure.getMessage());
    }
    verifyNoInteractions(transactions);
  }
}
