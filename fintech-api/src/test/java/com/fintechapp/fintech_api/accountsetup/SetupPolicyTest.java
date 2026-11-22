package com.fintechapp.fintech_api.accountsetup;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fintechapp.fintech_api.accountsetup.application.CompleteAccountSetup;
import com.fintechapp.fintech_api.accountsetup.application.SetupProfile;
import com.fintechapp.fintech_api.accountsetup.application.ports.SetupAccountStore;
import com.fintechapp.fintech_api.accountsetup.application.ports.SetupAccountStore.LockedAccount;
import com.fintechapp.fintech_api.accountsetup.domain.SetupSettings;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SetupPolicyTest {
  private static final String OWNER = "owner";
  private static final YearMonth DECEMBER = YearMonth.of(2025, 12);
  private static final YearMonth JANUARY = YearMonth.of(2026, 1);
  private final SetupAccountStore store = mock(SetupAccountStore.class);
  private final LockedAccount account = mock(LockedAccount.class);
  private final List<String> evictions = new ArrayList<>();

  @Test
  void validatesIncomeBeforeCurrencyAndNormalizesIsoCodes() {
    assertEquals(new SetupSettings(0, "CAD"), SetupSettings.from(BigDecimal.ZERO, "cad"));
    assertThrows(
        SetupSettings.InvalidIncome.class,
        () -> SetupSettings.from(new BigDecimal("1e1000"), "xyz"));
    assertThrows(
        SetupSettings.InvalidIncome.class, () -> SetupSettings.from(BigDecimal.valueOf(-1), "CAD"));
    assertThrows(
        SetupSettings.InvalidCurrency.class, () -> SetupSettings.from(BigDecimal.ZERO, "xyz"));
  }

  @Test
  void persistsAndAssemblesTheSameUtcPeriodAcrossTheYearBoundary() {
    when(store.lock(OWNER)).thenReturn(Optional.of(account));
    when(account.currency()).thenReturn("USD");
    var profile = mock(SetupProfile.class);
    when(account.profile(DECEMBER)).thenReturn(profile);

    assertSame(profile, operation("2025-12-31T23:59:59Z").execute(OWNER, BigDecimal.TEN, "cad"));
    var order = inOrder(store, account);
    order.verify(store).lock(OWNER);
    order.verify(account).isComplete();
    order.verify(account).currency();
    order.verify(account).hasFinancialData();
    order.verify(account).changeCurrency("CAD");
    order.verify(account).saveIncome(DECEMBER, 10);
    order.verify(account).markComplete();
    order.verify(account).profile(DECEMBER);
    assertEquals(List.of(OWNER), evictions);
  }

  @Test
  void retryDoesNotReadFinancialEligibilityOrWriteAndUsesTheCurrentUtcMonth() {
    when(store.lock(OWNER)).thenReturn(Optional.of(account));
    when(account.isComplete()).thenReturn(true);
    operation("2026-01-01T00:00:00Z").execute(OWNER, BigDecimal.TEN, "xyz");
    verify(account).isComplete();
    verify(account).profile(JANUARY);
    verifyNoMoreInteractions(account);
    assertTrue(evictions.isEmpty());
  }

  @Test
  void existingFinancialDataBlocksAChangeButNotTheMatchingCurrency() {
    when(store.lock(OWNER)).thenReturn(Optional.of(account));
    when(account.currency()).thenReturn("USD");
    when(account.hasFinancialData()).thenReturn(true);
    var operation = operation("2026-01-01T00:00:00Z");
    assertThrows(
        CompleteAccountSetup.CurrencyChangeBlocked.class,
        () -> operation.execute(OWNER, BigDecimal.ZERO, "CAD"));
    verify(account, never()).saveIncome(any(), anyDouble());
    assertTrue(evictions.isEmpty());
    operation.execute(OWNER, BigDecimal.ZERO, "usd");
    verify(account).hasFinancialData();
    verify(account).saveIncome(JANUARY, 0);
    assertEquals(List.of(OWNER), evictions);
  }

  private CompleteAccountSetup operation(String instant) {
    return new CompleteAccountSetup(
        store, evictions::add, Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
  }
}
