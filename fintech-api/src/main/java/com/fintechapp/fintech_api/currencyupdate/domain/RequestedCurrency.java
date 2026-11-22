package com.fintechapp.fintech_api.currencyupdate.domain;

import java.util.Locale;

public final class RequestedCurrency {
  private RequestedCurrency() {}

  public static String normalize(String currency) {
    if (currency == null || currency.isBlank()) throw new MissingCode();
    String code = currency.trim().toUpperCase(Locale.ROOT);
    if (!code.matches("^[A-Z]{3}$")) throw new InvalidCode();
    return code;
  }

  public static final class MissingCode extends RuntimeException {}

  public static final class InvalidCode extends RuntimeException {}
}
