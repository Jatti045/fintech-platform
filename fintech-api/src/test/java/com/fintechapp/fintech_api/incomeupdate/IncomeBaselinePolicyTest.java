package com.fintechapp.fintech_api.incomeupdate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fintechapp.fintech_api.incomeupdate.application.IncomeUpdateProfile;
import com.fintechapp.fintech_api.incomeupdate.application.UpdateIncomeBaseline;
import com.fintechapp.fintech_api.incomeupdate.application.ports.IncomeBaselineStore;
import com.fintechapp.fintech_api.incomeupdate.application.ports.IncomeBaselineStore.LockedOwner;
import com.fintechapp.fintech_api.incomeupdate.domain.IncomeBaselineChange;
import java.time.YearMonth;
import java.util.Optional;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

class IncomeBaselinePolicyTest {
  private static final String OWNER = "owner";
  private final IncomeBaselineStore store = mock(IncomeBaselineStore.class);
  private final LockedOwner owner = mock(LockedOwner.class);

  @Test
  void rejectsAllNonfiniteAmountsBeforeWriteOrEviction() {
    when(store.lock(OWNER)).thenReturn(Optional.of(owner));
    var operation = new UpdateIncomeBaseline(store, ignored -> fail("Unexpected eviction"));
    for (double amount :
        new double[] {Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NaN}) {
      assertThrows(
          IncomeBaselineChange.NonfiniteAmount.class,
          () -> new IncomeBaselineChange(YearMonth.of(2024, 1), amount));
      assertThrows(
          IncomeBaselineChange.NonfiniteAmount.class,
          () -> operation.execute(OWNER, amount, 0, Integer.MAX_VALUE));
    }
    verifyNoInteractions(owner);
  }

  @Test
  void preservesValidationPrecedenceAndZeroBasedPeriods() {
    assertThrows(
        IncomeBaselineChange.MissingAmount.class,
        () -> IncomeBaselineChange.from(null, null, null));
    assertThrows(
        IncomeBaselineChange.NegativeAmount.class,
        () -> IncomeBaselineChange.from(-1d, null, null));
    assertThrows(
        IncomeBaselineChange.MissingPeriod.class, () -> IncomeBaselineChange.from(0d, null, 0));
    assertThrows(
        IncomeBaselineChange.InvalidPeriod.class, () -> IncomeBaselineChange.from(0d, 12, 2024));
    assertThrows(
        IncomeBaselineChange.InvalidPeriod.class, () -> IncomeBaselineChange.from(0d, 0, 0));
    assertEquals(
        new IncomeBaselineChange(YearMonth.of(2024, 2), 0), IncomeBaselineChange.from(0d, 1, 2024));
    assertEquals(YearMonth.of(2023, 12), IncomeBaselineChange.from(1d, 11, 2023).period());
  }

  @Test
  @SuppressWarnings("unchecked")
  void locksThenWritesSchedulesSummaryEvictionAndReadsTheSamePeriod() {
    var eviction = (Consumer<String>) mock(Consumer.class);
    var period = YearMonth.of(2024, 2);
    var profile = mock(IncomeUpdateProfile.class);
    when(store.lock(OWNER)).thenReturn(Optional.of(owner));
    when(owner.profile(period)).thenReturn(profile);
    assertSame(profile, new UpdateIncomeBaseline(store, eviction).execute(OWNER, 125.125, 1, 2024));
    var order = inOrder(store, owner, eviction);
    order.verify(store).lock(OWNER);
    order.verify(owner).upsert(new IncomeBaselineChange(period, 125.125));
    order.verify(eviction).accept(OWNER);
    order.verify(owner).profile(period);
    verifyNoMoreInteractions(store, owner, eviction);
  }

  @Test
  void missingOwnerPrecedesFieldValidationAndInvalidPeriodDoesNotWrite() {
    when(store.lock(OWNER)).thenReturn(Optional.of(owner));
    var operation = new UpdateIncomeBaseline(store, ignored -> fail("Unexpected eviction"));
    assertThrows(
        UpdateIncomeBaseline.OwnerNotFound.class,
        () -> operation.execute("missing", null, null, null));
    assertThrows(
        IncomeBaselineChange.InvalidPeriod.class, () -> operation.execute(OWNER, 0d, 12, 2024));
    verifyNoInteractions(owner);
  }
}
