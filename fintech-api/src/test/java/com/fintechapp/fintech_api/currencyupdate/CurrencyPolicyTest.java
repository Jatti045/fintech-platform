package com.fintechapp.fintech_api.currencyupdate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fintechapp.fintech_api.currencyupdate.application.ChangeAccountCurrency;
import com.fintechapp.fintech_api.currencyupdate.application.ports.CurrencyAccountStore;
import com.fintechapp.fintech_api.currencyupdate.application.ports.CurrencyAccountStore.LockedAccount;
import com.fintechapp.fintech_api.currencyupdate.domain.RequestedCurrency;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

class CurrencyPolicyTest {
  private final CurrencyAccountStore store = mock(CurrencyAccountStore.class);
  private final LockedAccount account = mock(LockedAccount.class);
  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2024-01-01T00:00:00Z"), ZoneOffset.UTC);
  private static final YearMonth JANUARY = YearMonth.of(2024, 1);

  @Test
  void normalizesTheExistingServiceInputWithoutCheckingIsoMembership() {
    assertEquals("XYZ", RequestedCurrency.normalize(" xyz "));
    assertThrows(RequestedCurrency.MissingCode.class, () -> RequestedCurrency.normalize(" "));
    assertThrows(RequestedCurrency.InvalidCode.class, () -> RequestedCurrency.normalize("US"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void locksChecksSavesRegistersEvictionAndReadsInOrder() {
    var eviction = (Consumer<String>) mock(Consumer.class);
    when(store.lock("owner")).thenReturn(Optional.of(account));
    when(account.currency()).thenReturn("USD");
    new ChangeAccountCurrency(store, eviction, CLOCK).execute("owner", "xyz");
    var order = inOrder(store, account, eviction);
    order.verify(store).lock("owner");
    order.verify(account).currency();
    order.verify(account).hasFinancialData();
    order.verify(account).saveCurrency("XYZ");
    order.verify(eviction).accept("owner");
    order.verify(account).profile(JANUARY);
  }

  @Test
  void unchangedCurrencySkipsEligibilityWritesAndEviction() {
    when(store.lock("owner")).thenReturn(Optional.of(account));
    when(account.currency()).thenReturn("USD");
    new ChangeAccountCurrency(store, ignored -> fail("No eviction expected"), CLOCK)
        .execute("owner", "usd");
    verify(account).currency();
    verify(account).profile(JANUARY);
    verifyNoMoreInteractions(account);
  }

  @Test
  void blockedChangeDoesNotWriteOrCalculateProfileAndMissingOwnerPrecedesValidation() {
    when(store.lock("owner")).thenReturn(Optional.of(account));
    when(account.currency()).thenReturn("USD");
    when(account.hasFinancialData()).thenReturn(true);
    var operation =
        new ChangeAccountCurrency(store, ignored -> fail("No eviction expected"), CLOCK);
    assertThrows(
        ChangeAccountCurrency.AccountNotFound.class, () -> operation.execute("missing", null));
    assertThrows(
        ChangeAccountCurrency.FinancialDataExists.class, () -> operation.execute("owner", "CAD"));
    verify(account).currency();
    verify(account).hasFinancialData();
    verifyNoMoreInteractions(account);
  }
}
