package com.fintechapp.fintech_api.recurring.adapters.persistence;

import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.recurring.domain.ExpenseObservation;
import com.fintechapp.fintech_api.recurring.domain.repositories.ExpenseHistory;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import java.time.Instant;
import java.util.List;

public final class JpaExpenseHistory implements ExpenseHistory {
  private final TransactionRepository transactions;

  public JpaExpenseHistory(TransactionRepository transactions) {
    this.transactions = transactions;
  }

  @Override
  public List<ExpenseObservation> findSince(String userId, Instant cutoff) {
    return transactions
        .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(
            userId, TransactionType.EXPENSE, cutoff)
        .stream()
        .map(row ->
            new ExpenseObservation(
                row.getId(),
                row.getName(),
                row.getAmount(),
                row.getDate(),
                row.getBaseCurrency(),
                row.getType() == TransactionType.EXPENSE,
                row.isTransfer()))
        .toList();
  }
}
