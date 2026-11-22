package com.fintechapp.fintech_api.recurring.domain.repositories;

import com.fintechapp.fintech_api.recurring.domain.ExpenseObservation;
import java.time.Instant;
import java.util.List;

public interface ExpenseHistory {
  /** Owner-scoped expenses from the inclusive cutoff, in ascending date order. */
  List<ExpenseObservation> findSince(String userId, Instant cutoff);
}
