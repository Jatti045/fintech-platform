package com.fintechapp.fintech_api.shared.domain;

import java.util.function.BooleanSupplier;

/** A change is permitted only before any financial data has been recorded. */
public enum CurrencyChange {
  UNCHANGED,
  ALLOWED,
  BLOCKED;

  public static CurrencyChange decide(
      String current, String requested, BooleanSupplier hasFinancialData) {
    if (requested.equals(current)) return UNCHANGED;
    return hasFinancialData.getAsBoolean() ? BLOCKED : ALLOWED;
  }
}
