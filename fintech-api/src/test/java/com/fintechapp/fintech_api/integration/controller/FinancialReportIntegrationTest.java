package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.service.*;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class FinancialReportIntegrationTest extends BaseIntegrationTest {
    @Autowired FinancialReportService reports;
    @Autowired PlatformTransactionManager manager;
    @MockitoSpyBean IncomeCalculationService income;
    User user;
    static final Instant START = Instant.parse("2026-02-01T00:00:00Z");
    @BeforeEach void prepare() { user = createUser("report-" + UUID.randomUUID() + "@example.com", "Password123!", "report"); }
    @AfterEach void clean() {
        reset(income);
        new TransactionTemplate(manager).executeWithoutResult(s -> {
            transactionRepository.deleteByUser_Id(user.getId()); budgetRepository.deleteByUser_Id(user.getId());
            userMonthlyIncomeRepository.deleteByUser_Id(user.getId()); userRepository.deleteById(user.getId());
        });
    }
    AuthenticatedUser auth() { return new AuthenticatedUser(user.getId(), user.getEmail(), 0L); }
    FinancialReportResponse.Report report() { return reports.report(auth(), 2026, 1); }
    @Test void completeReportReconcilesRefundsTransfersBudgetsAndMoreThanTwentyRows() throws Exception {
        Budget b = createBudget(user, "Food", 100, START);
        for (int i = 0; i < 25; i++) createTransaction(user, b, "meal", START.plusSeconds(86400), "Food", TransactionType.EXPENSE, 10);
        createTransaction(user, b, "refund", START.plusSeconds(172800), "Food", TransactionType.EXPENSE, -30);
        createTransaction(user, null, "salary", START, "Income", TransactionType.INCOME, 200);
        Transaction transfer = createTransaction(user, null, "transfer", START, "Transfer", TransactionType.EXPENSE, 1000);
        transfer.setTransfer(true); transactionRepository.save(transfer);
        createTransaction(user, null, "previous income", START.minusSeconds(1), "Income", TransactionType.INCOME, 100);
        createTransaction(user, b, "next month", Instant.parse("2026-03-01T00:00:00Z"), "Food", TransactionType.EXPENSE, 999);
        var r = report();
        assertEquals(27, r.transactionCount()); assertEquals(28, r.daily().size());
        assertEquals(220, r.summary().netSpent()); assertEquals(-20, r.summary().netRemaining());
        assertEquals(250, r.grossExpenses()); assertEquals(30, r.expenseCredits());
        assertEquals(220, r.daily().stream().mapToDouble(x -> x.netSpent()).sum());
        assertEquals(220, r.categories().stream().mapToDouble(x -> x.netSpent()).sum());
        assertEquals(220, r.budgets().get(0).spent()); assertEquals(-120, r.budgets().get(0).remaining());
        assertEquals(100, r.previousPeriod().incomeChangePercentage()); assertNull(r.previousPeriod().spendingChangePercentage());
        for (int page : new int[]{1, 2}) mockMvc.perform(get("/api/transactions").header(authHeaderName(), authHeader(user))
                .param("currentMonth", "1").param("currentYear", "2026").param("page", String.valueOf(page))).andExpect(status().isOk());
        assertEquals(r.summary(), report().summary());
        mockMvc.perform(get("/api/financial-summary/report").header(authHeaderName(), authHeader(user)).param("year", "2026").param("month", "1")
                .param("searchQuery", "nothing")).andExpect(status().isOk()).andExpect(jsonPath("$.data.summary.netSpent").value(220));
    }
    @Test void missingAndExplicitZeroIncomeRemainDistinctAndEmptyMonthsAreRealZero() {
        var empty = report(); assertEquals("UNCONFIGURED", empty.incomeBasis()); assertFalse(empty.expectedIncomeConfigured());
        assertEquals(0, empty.transactionCount()); assertEquals(0, empty.summary().monthlyIncome());
        createMonthlyIncome(user, START, 0);
        var zero = report(); assertEquals("EXPECTED", zero.incomeBasis()); assertTrue(zero.expectedIncomeConfigured());
        createTransaction(user, null, "credit", START, "Food", TransactionType.EXPENSE, -15);
        assertEquals(-15, report().summary().netSpent()); assertEquals(15, report().summary().netRemaining());
    }
    @Test void editsAndDeletionRefreshUncachedReport() throws Exception {
        Budget b = createBudget(user, "Food", 100, START);
        Transaction t = createTransaction(user, b, "meal", START, "Food", TransactionType.EXPENSE, 20);
        assertEquals(20, report().summary().netSpent());
        mockMvc.perform(patch("/api/transactions/" + t.getId()).header(authHeaderName(), authHeader(user)).contentType(json())
                .content("{\"amount\":35,\"category\":\"Dining\"}")).andExpect(status().isOk());
        assertEquals(35, report().summary().netSpent()); assertEquals("dining", report().categories().get(0).category());
        mockMvc.perform(delete("/api/transactions/" + t.getId()).header(authHeaderName(), authHeader(user))).andExpect(status().isOk());
        assertEquals(0, report().summary().netSpent());
    }
    @Test void reportingHandlesLeapYearsYearBoundariesCurrencyAndExpectedIncome() {
        user.setCurrency("EUR"); userRepository.save(user);
        createMonthlyIncome(user, Instant.parse("2023-12-01T00:00:00Z"), 1000);
        createTransaction(user, null, "last December", Instant.parse("2023-12-31T23:59:59Z"), "Food", TransactionType.EXPENSE, 40);
        createTransaction(user, null, "January", Instant.parse("2024-01-01T00:00:00Z"), "Food", TransactionType.EXPENSE, 10);
        var january = reports.report(auth(), 2024, 0);
        assertEquals(2023, january.previousPeriod().year()); assertEquals(11, january.previousPeriod().month());
        assertEquals(40, january.previousPeriod().netSpent()); assertEquals(10, january.summary().netSpent());
        assertEquals("EUR", january.currency()); assertEquals("EXPECTED", january.incomeBasis());
        assertEquals(1000, january.summary().monthlyIncome()); assertEquals(0, january.summary().actualIncome());
        assertEquals(29, reports.report(auth(), 2024, 1).daily().size());
    }
    @Test void subCentLegacyValuesNeverMakeDailyOrCategoryTotalsDisagree() {
        for (int i = 1; i <= 10; i++) createTransaction(user, null, "fraction", START.plusSeconds(i * 86400), "C" + i, TransactionType.EXPENSE, 0.004);
        createTransaction(user, null, "fractional credit", START, "Credit", TransactionType.EXPENSE, -0.006);
        var r = report();
        assertEquals(r.summary().netSpent(), r.daily().stream().mapToDouble(d -> d.netSpent()).sum(), 0.000001);
        assertEquals(r.summary().netSpent(), r.categories().stream().mapToDouble(c -> c.netSpent()).sum(), 0.000001);
        assertTrue(r.daily().stream().allMatch(d -> d.grossExpenses() >= 0 && d.expenseCredits() >= 0));
    }

    @Test void authorizationIsolationAndInvalidPeriods() throws Exception {
        mockMvc.perform(get("/api/financial-summary/report").param("year", "2026").param("month", "1")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/financial-summary/report").header(authHeaderName(), authHeader(user)).param("year", "2026").param("month", "12")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/financial-summary/report").header(authHeaderName(), authHeader(user)).param("year", "2026")).andExpect(status().isBadRequest());
        User other = createUser("other-" + UUID.randomUUID() + "@example.com", "Password123!", "other");
        try {
            Transaction t = createTransaction(other, null, "private", START, "Food", TransactionType.EXPENSE, 1000);
            assertEquals(0, report().summary().netSpent()); transactionRepository.deleteById(t.getId());
        } finally { userRepository.deleteById(other.getId()); }
    }
    @Test void concurrentWriterCannotMixTotalsBreakdownsOrIncomeSnapshots() throws Exception {
        createTransaction(user, null, "meal", START, "Food", TransactionType.EXPENSE, 20);
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        doAnswer(inv -> { entered.countDown(); assertTrue(release.await(10, TimeUnit.SECONDS)); return inv.callRealMethod(); })
                .when(income).resolveExpectedForMonth(any(), eq(2026), eq(1));
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<FinancialReportResponse.Report> future = pool.submit(this::report);
            assertTrue(entered.await(10, TimeUnit.SECONDS));
            createTransaction(user, null, "later", START, "Food", TransactionType.EXPENSE, 100);
            createMonthlyIncome(user, START, 1000);
            release.countDown(); var r = future.get(10, TimeUnit.SECONDS);
            assertEquals(20, r.summary().netSpent()); assertEquals(20, r.categories().get(0).netSpent());
            assertEquals(0, r.summary().expectedIncome()); assertFalse(r.expectedIncomeConfigured());
        } finally { release.countDown(); pool.shutdownNow(); }
    }
}
