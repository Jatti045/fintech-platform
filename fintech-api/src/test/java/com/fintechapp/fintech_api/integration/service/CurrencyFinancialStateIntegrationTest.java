package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.budget.ApplySuggestionsRequest;
import com.fintechapp.fintech_api.dto.budget.CreateBudgetRequest;
import com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest;
import com.fintechapp.fintech_api.dto.user.UpdateCurrencyRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.service.BudgetService;
import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;
import com.fintechapp.fintech_api.service.MonthlyIncomeService;
import com.fintechapp.fintech_api.service.TransactionService;
import com.fintechapp.fintech_api.service.UserService;

// Two concurrent writers plus the independent PostgreSQL lock observer.
@TestPropertySource(properties = "spring.datasource.hikari.maximum-pool-size=3")
class CurrencyFinancialStateIntegrationTest extends BaseIntegrationTest {
    // Cache transport is outside this regression; all financial DB operations and locks are real.
    @MockitoBean private FinancialCacheInvalidator cacheInvalidator;
    @Autowired private UserService users;
    @Autowired private TransactionService transactions;
    @Autowired private BudgetService budgets;
    @Autowired private MonthlyIncomeService income;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbc;

    enum FinancialState { TRANSACTION, BUDGET, INCOME, SUGGESTED_BUDGET }

    private User user() {
        return createUser("currency-" + UUID.randomUUID() + "@example.com", "Password123!", "CurrencyTest");
    }

    private AuthenticatedUser auth(User user) {
        return new AuthenticatedUser(user.getId(), user.getEmail(), 0L);
    }

    private void write(User user, FinancialState state) {
        switch (state) {
            case TRANSACTION -> transactions.createTransaction(auth(user), new CreateTransactionRequest(
                    "Payroll", 9, 2026, "2026-10-15T00:00:00Z", "Salary", "INCOME", 100d,
                    null, null, "USD", "USD", 100d));
            case BUDGET -> budgets.createBudget(auth(user), new CreateBudgetRequest("Food", 500d, 9, 2026));
            case INCOME -> income.upsertForMonth(user, 2026, 9, 1000d);
            case SUGGESTED_BUDGET -> budgets.applyBudgetSuggestions(auth(user), new ApplySuggestionsRequest(
                    9, 2026, List.of(new ApplySuggestionsRequest.Item("Food", 500d))));
        }
    }

    @Test
    void noFinancialDataAllowsChange() {
        User user = user();
        assertEquals("CAD", users.updateCurrency(auth(user), new UpdateCurrencyRequest("cad")).data().currency());
    }

    @ParameterizedTest
    @EnumSource(FinancialState.class)
    void anyMonetaryStatePreventsRelabelingButSameCurrencyIsANoop(FinancialState state) {
        User user = user();
        write(user, state);
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> users.updateCurrency(auth(user), new UpdateCurrencyRequest("CAD")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertTrue(error.getReason().contains("financial data"));
        assertEquals("USD", userRepository.findById(user.getId()).orElseThrow().getCurrency());
        assertEquals("USD", users.updateCurrency(auth(user), new UpdateCurrencyRequest("usd")).data().currency());
    }

    @Test
    void zeroMonetaryRowsStillPreventCurrencyChange() {
        User user = user();
        createMonthlyIncome(user, Instant.parse("2026-10-01T00:00:00Z"), 0);
        assertThrows(ResponseStatusException.class,
                () -> users.updateCurrency(auth(user), new UpdateCurrencyRequest("CAD")));
        User other = user();
        createBudget(other, "Food", 0, Instant.parse("2026-10-01T00:00:00Z"));
        assertThrows(ResponseStatusException.class,
                () -> users.updateCurrency(auth(other), new UpdateCurrencyRequest("CAD")));
    }

    @ParameterizedTest
    @CsvSource({"TRANSACTION,false", "TRANSACTION,true", "BUDGET,false", "BUDGET,true",
            "INCOME,false", "INCOME,true", "SUGGESTED_BUDGET,false", "SUGGESTED_BUDGET,true"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void firstFinancialWriteAndCurrencyChangeSerialize(FinancialState state, boolean currencyFirst) throws Exception {
        var tx = new TransactionTemplate(transactionManager);
        User user = tx.execute(status -> user());
        when(currencyConversionService.convert(100d, "USD", "CAD")).thenReturn(135d);
        var pool = Executors.newFixedThreadPool(2);
        var firstHasWritten = new CountDownLatch(1);
        var releaseFirst = new CountDownLatch(1);
        var secondStarted = new CountDownLatch(1);
        var secondPid = new AtomicInteger();
        try {
            var first = pool.submit(() -> tx.execute(status -> {
                if (currencyFirst) users.updateCurrency(auth(user), new UpdateCurrencyRequest("CAD"));
                else write(user, state);
                firstHasWritten.countDown();
                await(releaseFirst);
                return null;
            }));
            assertTrue(firstHasWritten.await(10, TimeUnit.SECONDS));
            var second = pool.submit(() -> {
                try {
                    tx.executeWithoutResult(status -> {
                        secondPid.set(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
                        secondStarted.countDown();
                        if (currencyFirst) write(user, state);
                        else users.updateCurrency(auth(user), new UpdateCurrencyRequest("CAD"));
                    });
                    return true;
                } catch (ResponseStatusException error) {
                    assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
                    return false;
                }
            });
            assertTrue(secondStarted.await(10, TimeUnit.SECONDS));
            // Observe an actual PostgreSQL lock wait before releasing the first
            // transaction. This test does not infer contention from a timing delay.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            boolean blocked = false;
            while (System.nanoTime() < deadline && !second.isDone()) {
                blocked = Boolean.TRUE.equals(jdbc.queryForObject(
                        "select cardinality(pg_blocking_pids(?)) > 0", Boolean.class, secondPid.get()));
                if (blocked) break;
                Thread.sleep(10);
            }
            assertTrue(blocked, "Financial writes and currency changes must contend on the same user row");
            releaseFirst.countDown();
            first.get(10, TimeUnit.SECONDS);
            assertEquals(currencyFirst, second.get(10, TimeUnit.SECONDS));
            tx.executeWithoutResult(status -> {
                String expectedCurrency = currencyFirst ? "CAD" : "USD";
                assertEquals(expectedCurrency, userRepository.findById(user.getId()).orElseThrow().getCurrency());
                if (state == FinancialState.TRANSACTION) {
                    var rows = transactionRepository.findByUser_IdOrderByDateDesc(user.getId());
                    assertEquals(1, rows.size());
                    assertEquals(expectedCurrency, rows.get(0).getBaseCurrency());
                    assertEquals(currencyFirst ? 135d : 100d, rows.get(0).getAmount());
                } else if (state == FinancialState.INCOME) {
                    assertTrue(userMonthlyIncomeRepository.existsByUser_Id(user.getId()));
                } else {
                    assertTrue(budgetRepository.existsByUser_Id(user.getId()));
                }
            });
        } finally {
            releaseFirst.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
            tx.executeWithoutResult(status -> {
                transactionRepository.deleteByUser_Id(user.getId());
                budgetRepository.deleteByUser_Id(user.getId());
                userMonthlyIncomeRepository.deleteByUser_Id(user.getId());
                userRepository.deleteById(user.getId());
            });
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            assertTrue(latch.await(15, TimeUnit.SECONDS), "Timed out waiting for race coordination");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AssertionError(error);
        }
    }
}
