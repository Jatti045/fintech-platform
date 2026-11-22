package com.fintechapp.fintech_api.incomeupdate.application;

import com.fintechapp.fintech_api.incomeupdate.application.ports.IncomeBaselineStore;
import com.fintechapp.fintech_api.incomeupdate.domain.IncomeBaselineChange;
import java.util.function.Consumer;

public final class UpdateIncomeBaseline {
  private final IncomeBaselineStore store;
  private final Consumer<String> scheduleSummaryEviction;

  /** The eviction consumer defers its effect until the enclosing transaction commits. */
  public UpdateIncomeBaseline(IncomeBaselineStore store, Consumer<String> scheduleSummaryEviction) {
    this.store = store;
    this.scheduleSummaryEviction = scheduleSummaryEviction;
  }

  public IncomeUpdateProfile execute(String ownerId, Double amount, Integer month, Integer year) {
    var owner = store.lock(ownerId).orElseThrow(OwnerNotFound::new);
    var change = IncomeBaselineChange.from(amount, month, year);
    owner.upsert(change);
    scheduleSummaryEviction.accept(ownerId);
    return owner.profile(change.period());
  }

  public static final class OwnerNotFound extends RuntimeException {}
}
