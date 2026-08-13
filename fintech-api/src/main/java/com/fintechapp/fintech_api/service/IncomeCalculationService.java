package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Unified income calculation strategy.
 *
 * <p>Separates the user's <b>expected</b> income (the planning baseline they
 * set on the profile, stored per month) from the <b>actual</b> income (the sum
 * of {@link TransactionType#INCOME} transactions logged for the month — either
 * manually or synced via Plaid).</p>
 *
 * <p>{@code effectiveIncome} is what downstream net calculations use: if actual
 * inflow exists it wins (real money in), otherwise we fall back to the expected
 * baseline so planning still works before the first paycheck arrives.</p>
 */
@Service
public class IncomeCalculationService {

    private final MonthlyIncomeService monthlyIncomeService;
    private final TransactionRepository transactionRepository;

    public IncomeCalculationService(
            MonthlyIncomeService monthlyIncomeService,
            TransactionRepository transactionRepository) {
        this.monthlyIncomeService = monthlyIncomeService;
        this.transactionRepository = transactionRepository;
    }

    /** The stored expected-income baseline for the month (user profile setting). */
    @Transactional(readOnly = true)
    public double resolveExpectedForMonth(User user, int year, int month) {
        return monthlyIncomeService.resolveForMonth(user, year, month);
    }

    /** Sum of INCOME transactions actually logged in the month. */
    @Transactional(readOnly = true)
    public double resolveActualForMonth(User user, int year, int month) {
        Instant from = monthlyIncomeService.monthStart(year, month);
        Instant to = LocalDate.of(year, month + 1, 1)
                .plusMonths(1)
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);
        return transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.INCOME, from, to);
    }

    /**
     * Effective income for downstream net calculations: actual inflow when it
     * exists, otherwise the expected baseline.
     */
    @Transactional(readOnly = true)
    public double resolveEffectiveForMonth(User user, int year, int month) {
        double actual = resolveActualForMonth(user, year, month);
        if (actual > 0) {
            return actual;
        }
        return resolveExpectedForMonth(user, year, month);
    }

    /** Effective income for the current month. */
    @Transactional(readOnly = true)
    public double resolveEffectiveForCurrentMonth(User user) {
        LocalDate utcNow = LocalDate.now(ZoneOffset.UTC);
        return resolveEffectiveForMonth(user, utcNow.getYear(), utcNow.getMonthValue() - 1);
    }
}
