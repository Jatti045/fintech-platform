package com.fintechapp.fintech_api.accountsetup.domain;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Locale;

public record SetupSettings(double monthlyIncome, String currency) {
  public static SetupSettings from(BigDecimal monthlyIncome, String currency) {
    double income = monthlyIncome.doubleValue();
    if (!Double.isFinite(income) || income < 0) throw new InvalidIncome();
    String normalized = currency.toUpperCase(Locale.ROOT);
    try {
      Currency.getInstance(normalized);
    } catch (IllegalArgumentException exception) {
      throw new InvalidCurrency();
    }
    return new SetupSettings(income, normalized);
  }

  public static final class InvalidIncome extends RuntimeException {}

  public static final class InvalidCurrency extends RuntimeException {}
}
