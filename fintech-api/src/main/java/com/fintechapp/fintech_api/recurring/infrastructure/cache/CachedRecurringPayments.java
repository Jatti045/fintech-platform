package com.fintechapp.fintech_api.recurring.infrastructure.cache;

import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Data;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Item;
import com.fintechapp.fintech_api.recurring.application.GetRecurringPayments;
import com.fintechapp.fintech_api.recurring.domain.RecurringPayment;
import java.util.ArrayList;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;

public class CachedRecurringPayments {
  private final GetRecurringPayments useCase;

  public CachedRecurringPayments(GetRecurringPayments useCase) {
    this.useCase = useCase;
  }

  // Keep the existing cache region, user key, and serialized DTO class names.
  @Cacheable(cacheNames = "recurringPayments", key = "#userId")
  public Data read(String userId) {
    return new Data(
        useCase.execute(userId).stream()
            .map(CachedRecurringPayments::toItem)
            .collect(Collectors.toCollection(ArrayList::new)));
  }

  private static Item toItem(RecurringPayment item) {
    var change = item.amountChange();
    return new Item(
        item.seriesKey(),
        item.name(),
        item.expectedAmount(),
        item.currency(),
        item.cadence(),
        item.intervalDays(),
        item.nextExpectedDate(),
        item.lastOccurredDate(),
        item.occurrences(),
        item.confidence(),
        item.usualDayOfMonth(),
        change == null
            ? null
            : new Item.AmountChange(change.previousAmount(), change.currentAmount()),
        item.matchedTransactions().stream()
            .map(tx -> new Item.MatchedTransaction(tx.id(), tx.date(), tx.amount()))
            .collect(Collectors.toCollection(ArrayList::new)));
  }
}
