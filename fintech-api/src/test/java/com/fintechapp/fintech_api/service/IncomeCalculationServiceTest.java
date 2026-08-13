package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;

@ExtendWith(MockitoExtension.class)
class IncomeCalculationServiceTest {

    @Mock
    private MonthlyIncomeService monthlyIncomeService;

    @Mock
    private TransactionRepository transactionRepository;

    private IncomeCalculationService service;

    private final User user = new User();

    @BeforeEach
    void setUp() {
        user.setId("user-1");
        service = new IncomeCalculationService(monthlyIncomeService, transactionRepository);
        // Replicate the real monthStart so window math is deterministic.
        lenient().when(monthlyIncomeService.monthStart(any(Integer.class), any(Integer.class)))
                .thenAnswer(inv -> LocalDate.of(inv.getArgument(0), (int) inv.getArgument(1) + 1, 1)
                        .atStartOfDay().toInstant(ZoneOffset.UTC));
    }

    private void stubExpected(double value) {
        lenient().when(monthlyIncomeService.resolveForMonth(eq(user), any(Integer.class), any(Integer.class)))
                .thenReturn(value);
    }

    private void stubActual(double value) {
        lenient().when(transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                        eq("user-1"), eq(TransactionType.INCOME), any(Instant.class), any(Instant.class)))
                .thenReturn(value);
    }

    // ── Effective income strategy ────────────────────────────────────────────

    @Test
    void resolveEffectiveForMonth_actualGreaterThanZero_usesActual() {
        stubExpected(4000.0);
        stubActual(3200.0);
        assertEquals(3200.0, service.resolveEffectiveForMonth(user, 2026, 7));
    }

    @Test
    void resolveEffectiveForMonth_actualEqualToExpected_usesActual() {
        stubExpected(3000.0);
        stubActual(3000.0);
        assertEquals(3000.0, service.resolveEffectiveForMonth(user, 2026, 7));
    }

    @Test
    void resolveEffectiveForMonth_actualZero_fallsBackToExpected() {
        stubExpected(4000.0);
        stubActual(0.0);
        assertEquals(4000.0, service.resolveEffectiveForMonth(user, 2026, 7));
    }

    @Test
    void resolveEffectiveForMonth_actualNegative_fallsBackToExpected() {
        // Negative "income" is a transfer artefact; treat as no actual inflow.
        stubExpected(2500.0);
        stubActual(-120.0);
        assertEquals(2500.0, service.resolveEffectiveForMonth(user, 2026, 7));
    }

    @Test
    void resolveEffectiveForMonth_noExpectedNoActual_returnsZero() {
        stubExpected(0.0);
        stubActual(0.0);
        assertEquals(0.0, service.resolveEffectiveForMonth(user, 2026, 7));
    }

    // ── Expected income delegation ───────────────────────────────────────────

    @Test
    void resolveExpectedForMonth_delegatesToMonthlyIncomeService() {
        when(monthlyIncomeService.resolveForMonth(user, 2026, 3)).thenReturn(5555.0);
        assertEquals(5555.0, service.resolveExpectedForMonth(user, 2026, 3));
        verify(monthlyIncomeService).resolveForMonth(user, 2026, 3);
    }

    // ── Actual income window ─────────────────────────────────────────────────

    @Test
    void resolveActualForMonth_buildsExclusiveMonthWindow() {
        when(transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                        eq("user-1"), eq(TransactionType.INCOME), any(Instant.class), any(Instant.class)))
                .thenReturn(777.0);

        double result = service.resolveActualForMonth(user, 2026, 7); // August 2026

        assertEquals(777.0, result);
        verify(transactionRepository).sumAmountByUserAndTypeAndDateBetween(
                eq("user-1"),
                eq(TransactionType.INCOME),
                eq(Instant.parse("2026-08-01T00:00:00Z")),
                eq(Instant.parse("2026-09-01T00:00:00Z")));
    }

    @Test
    void resolveActualForMonth_ignoresNonIncomeTypes() {
        stubActual(0.0);
        service.resolveActualForMonth(user, 2026, 1);
        verify(transactionRepository).sumAmountByUserAndTypeAndDateBetween(
                eq("user-1"), eq(TransactionType.INCOME), any(Instant.class), any(Instant.class));
    }

    @Test
    void resolveActualForMonth_decemberWindowRollsIntoNextYear() {
        when(transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                        eq("user-1"), eq(TransactionType.INCOME), any(Instant.class), any(Instant.class)))
                .thenReturn(1.0);
        service.resolveActualForMonth(user, 2026, 11); // December 2026
        verify(transactionRepository).sumAmountByUserAndTypeAndDateBetween(
                eq("user-1"),
                eq(TransactionType.INCOME),
                eq(Instant.parse("2026-12-01T00:00:00Z")),
                eq(Instant.parse("2027-01-01T00:00:00Z")));
    }

    // ── Current month ────────────────────────────────────────────────────────

    @Test
    void resolveEffectiveForCurrentMonth_usesCurrentUtcMonth() {
        LocalDate now = LocalDate.now(ZoneOffset.UTC);
        int month = now.getMonthValue() - 1;
        int year = now.getYear();
        // No actual inflow yet -> expected baseline is resolved and returned.
        stubExpected(1000.0);
        stubActual(0.0);
        assertEquals(1000.0, service.resolveEffectiveForCurrentMonth(user));
        verify(monthlyIncomeService).resolveForMonth(user, year, month);
    }

    // ── Validation ───────────────────────────────────────────────────────────

    @Test
    void resolveExpectedForMonth_invalidMonth_throws() {
        when(monthlyIncomeService.resolveForMonth(eq(user), any(Integer.class), any(Integer.class)))
                .thenThrow(new ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid month/year value"));
        assertThrows(ResponseStatusException.class, () -> service.resolveExpectedForMonth(user, 2026, 12));
    }
}

