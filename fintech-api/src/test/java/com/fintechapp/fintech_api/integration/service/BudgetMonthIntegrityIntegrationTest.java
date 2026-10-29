package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.budget.UpdateBudgetRequest;
import com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.service.BudgetService;
import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;
import com.fintechapp.fintech_api.service.FinancialReportService;
import com.fintechapp.fintech_api.service.InternalTransferReconciliationService;
import com.fintechapp.fintech_api.service.TransactionService;

// Each service call commits independently, including requests from concurrent workers.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class BudgetMonthIntegrityIntegrationTest extends BaseIntegrationTest {
    private static final Instant OCTOBER = Instant.parse("2026-10-01T00:00:00Z");
    private static final Instant NOVEMBER = Instant.parse("2026-11-01T00:00:00Z");
    private static final String MOVE_ERROR = "Cannot change budget month: there are transactions attached to this budget. "
            + "Remove or reassign those transactions first.";

    @Autowired private BudgetService budgets;
    @Autowired private TransactionService transactions;
    @Autowired private FinancialReportService reports;
    @Autowired private PlatformTransactionManager manager;
    @MockitoBean private FinancialCacheInvalidator cacheInvalidator;
    @MockitoSpyBean private InternalTransferReconciliationService reconciliation;

    private User user;
    private AuthenticatedUser auth;

    @BeforeEach
    void prepare() {
        user = createUser("budget-month-" + UUID.randomUUID() + "@example.com", "Password123!", "budget-month");
        auth = new AuthenticatedUser(user.getId(), user.getEmail(), 0L);
    }

    @AfterEach
    void clean() {
        new TransactionTemplate(manager).executeWithoutResult(s -> {
            transactionRepository.deleteByUser_Id(user.getId());
            budgetRepository.deleteByUser_Id(user.getId());
            userRepository.deleteById(user.getId());
        });
    }

    @ParameterizedTest
    @CsvSource({
            "2026-10-01T00:00:00Z, 2026-10-31T23:59:59.999999Z, '{\"month\":10}', 2026, 9",
            "2026-10-01T00:00:00Z, 2026-10-01T00:00:00Z, '{\"year\":2027}', 2026, 9",
            "2026-12-01T00:00:00Z, 2026-12-31T23:59:59.999999Z, '{\"month\":0,\"year\":2027}', 2026, 11",
            "2024-02-01T00:00:00Z, 2024-02-29T23:59:59.999999Z, '{\"month\":2}', 2024, 1",
            "2026-03-01T00:00:00Z, 2026-03-01T00:00:00Z, '{\"month\":1}', 2026, 2"
    })
    void populatedBudgetRejectsMovesAndKeepsMonthlyReportsConsistent(
            String budgetDate, String transactionDate, String payload, int year, int month) throws Exception {
        Budget budget = createBudget(user, "Food", 100, Instant.parse(budgetDate));
        transactions.createTransaction(auth, expense(budget, transactionDate));

        mockMvc.perform(patch("/api/budgets/{id}", budget.getId())
                .header(authHeaderName(), authHeader(user)).contentType(json()).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(MOVE_ERROR));

        Budget saved = budgetRepository.findById(budget.getId()).orElseThrow();
        assertEquals(Instant.parse(budgetDate), saved.getDate());
        assertEquals(25, saved.getSpent());
        assertEquals(1, transactionRepository.countByBudget_IdAndUser_Id(budget.getId(), user.getId()));
        var report = reports.report(auth, year, month);
        assertEquals(25, report.summary().netSpent());
        assertEquals(25, report.budgets().get(0).spent());
        assertEquals(1, report.transactionCount());
    }

    @Test
    void rejectedMoveDoesNotPartiallyApplyOtherProperties() throws Exception {
        Budget budget = createBudget(user, "Food", 100, OCTOBER);
        transactions.createTransaction(auth, expense(budget, OCTOBER.toString()));

        mockMvc.perform(patch("/api/budgets/{id}", budget.getId())
                .header(authHeaderName(), authHeader(user)).contentType(json())
                .content(asJson(Map.of("month", 10, "category", "Dining", "limit", 200))))
                .andExpect(status().isBadRequest());

        Budget saved = budgetRepository.findById(budget.getId()).orElseThrow();
        assertEquals(OCTOBER, saved.getDate());
        assertEquals("Food", saved.getCategory());
        assertEquals(100, saved.getLimit());
        assertEquals(25, saved.getSpent());
    }

    @Test
    void populatedBudgetAllowsCategoryLimitAndExplicitUnchangedPeriod() throws Exception {
        Budget budget = createBudget(user, "Food", 100, OCTOBER);
        transactions.createTransaction(auth, expense(budget, OCTOBER.toString()));

        mockMvc.perform(patch("/api/budgets/{id}", budget.getId())
                .header(authHeaderName(), authHeader(user)).contentType(json())
                .content(asJson(Map.of("month", 9, "year", 2026, "category", "Dining", "limit", 200))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.category").value("Dining"))
                .andExpect(jsonPath("$.data.limit").value(200));
        budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, 250.0, null, null));

        Budget saved = budgetRepository.findById(budget.getId()).orElseThrow();
        assertEquals(OCTOBER, saved.getDate());
        assertEquals("Dining", saved.getCategory());
        assertEquals(250, saved.getLimit());
        assertEquals(25, saved.getSpent());
    }

    @Test
    void zeroNetSpendingAndIncomeAttachmentsStillPreventMoves() {
        Budget budget = createBudget(user, "Food", 100, OCTOBER);
        createTransaction(user, budget, "expense", OCTOBER, "Food", TransactionType.EXPENSE, 25);
        createTransaction(user, budget, "refund", OCTOBER, "Food", TransactionType.EXPENSE, -25);
        assertEquals(0, budgetRepository.findById(budget.getId()).orElseThrow().getSpent());
        assertMoveRejected(budget);

        Budget incomeBudget = createBudget(user, "Income", 100, OCTOBER);
        createTransaction(user, incomeBudget, "income", OCTOBER, "Income", TransactionType.INCOME, 25);
        assertMoveRejected(incomeBudget);
    }

    @Test
    void emptyBudgetCanMoveAcrossYearAndLeapMonthBoundaries() {
        Budget budget = createBudget(user, "Food", 100, Instant.parse("2023-12-01T00:00:00Z"));
        budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, 0, 2024));
        assertEquals(Instant.parse("2024-01-01T00:00:00Z"), budgetRepository.findById(budget.getId()).orElseThrow().getDate());
        budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, 1, null));
        budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, 2, null));
        budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, null, 2025));
        assertEquals(Instant.parse("2025-03-01T00:00:00Z"), budgetRepository.findById(budget.getId()).orElseThrow().getDate());
    }

    @Test
    void emptyBudgetMoveStillEnforcesCategoryMonthUniqueness() throws Exception {
        Budget budget = createBudget(user, "Food", 100, OCTOBER);
        createBudget(user, "Dining", 100, NOVEMBER);

        mockMvc.perform(patch("/api/budgets/{id}", budget.getId())
                .header(authHeaderName(), authHeader(user)).contentType(json())
                .content(asJson(Map.of("month", 10, "category", "dining"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Another budget with this category exists for the same month"));
        assertEquals(OCTOBER, budgetRepository.findById(budget.getId()).orElseThrow().getDate());
        assertEquals("Food", budgetRepository.findById(budget.getId()).orElseThrow().getCategory());
    }

    @Test
    void transactionCreationRevalidatesMonthAfterConcurrentBudgetMove() throws Exception {
        Budget budget = createBudget(user, "Food", 100, OCTOBER);
        CountDownLatch moved = new CountDownLatch(1), releaseMove = new CountDownLatch(1);
        CountDownLatch creatorReachedLock = new CountDownLatch(1);
        doAnswer(invocation -> {
            creatorReachedLock.countDown();
            return invocation.callRealMethod();
        }).when(reconciliation).lockUser(user.getId());
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> mover = pool.submit(() -> new TransactionTemplate(manager).executeWithoutResult(s -> {
                budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, 10, null));
                budgetRepository.flush();
                moved.countDown();
                await(releaseMove);
            }));
            assertTrue(moved.await(10, TimeUnit.SECONDS));
            Future<ResponseStatusException> creator = pool.submit(() -> assertThrows(ResponseStatusException.class,
                    () -> transactions.createTransaction(auth, expense(budget, OCTOBER.toString()))));
            // The old implementation had already validated the stale month at this point.
            assertTrue(creatorReachedLock.await(10, TimeUnit.SECONDS));
            releaseMove.countDown();
            mover.get(10, TimeUnit.SECONDS);
            assertEquals(HttpStatus.NOT_FOUND, creator.get(10, TimeUnit.SECONDS).getStatusCode());
            assertEquals(NOVEMBER, budgetRepository.findById(budget.getId()).orElseThrow().getDate());
            assertEquals(0, transactionRepository.countByBudget_IdAndUser_Id(budget.getId(), user.getId()));
        } finally {
            releaseMove.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    @Test
    void budgetMoveWaitsForConcurrentTransactionAndThenRejectsIt() throws Exception {
        Budget budget = createBudget(user, "Food", 100, OCTOBER);
        CountDownLatch inserted = new CountDownLatch(1), releaseInsert = new CountDownLatch(1);
        CountDownLatch moveStarted = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> creator = pool.submit(() -> new TransactionTemplate(manager).executeWithoutResult(s -> {
                transactions.createTransaction(auth, expense(budget, OCTOBER.toString()));
                inserted.countDown();
                await(releaseInsert);
            }));
            assertTrue(inserted.await(10, TimeUnit.SECONDS));
            Future<ResponseStatusException> mover = pool.submit(() -> {
                moveStarted.countDown();
                return assertThrows(ResponseStatusException.class,
                        () -> budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, 10, null)));
            });
            assertTrue(moveStarted.await(10, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> mover.get(200, TimeUnit.MILLISECONDS));
            releaseInsert.countDown();
            creator.get(10, TimeUnit.SECONDS);
            assertEquals(HttpStatus.BAD_REQUEST, mover.get(10, TimeUnit.SECONDS).getStatusCode());
            assertEquals(OCTOBER, budgetRepository.findById(budget.getId()).orElseThrow().getDate());
            assertEquals(1, transactionRepository.countByBudget_IdAndUser_Id(budget.getId(), user.getId()));
        } finally {
            releaseInsert.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        }
    }

    private void assertMoveRejected(Budget budget) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> budgets.updateBudget(auth, budget.getId(), new UpdateBudgetRequest(null, null, 10, null)));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals(MOVE_ERROR, error.getReason());
    }

    private CreateTransactionRequest expense(Budget budget, String date) {
        return new CreateTransactionRequest("meal", null, null, date, "Food", "EXPENSE", 25.0,
                null, budget.getId(), "USD", "USD", 25.0);
    }

    private static void await(CountDownLatch latch) {
        try {
            assertTrue(latch.await(10, TimeUnit.SECONDS));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }
}
