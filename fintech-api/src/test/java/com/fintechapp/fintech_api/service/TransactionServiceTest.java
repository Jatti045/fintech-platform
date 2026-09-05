package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.transaction.TransactionDataResponse;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

        @Mock
        private BudgetRepository budgetRepository;

        @Mock
        private TransactionRepository transactionRepository;

        @Mock
        private UserRepository userRepository;

        @Mock
        private FinancialCacheInvalidator cacheInvalidator;

        private TransactionService transactionService;

        private AuthenticatedUser authUser;
        private User user;

        @BeforeEach
        void setUp() {
                transactionService = new TransactionService(
                                budgetRepository,
                                transactionRepository,
                                userRepository,
                                cacheInvalidator);

                authUser = new AuthenticatedUser("user-123", "user@example.com", 1234567890L);
                user = new User();
                user.setId("user-123");
                user.setEmail("user@example.com");
                user.setUsername("testuser");
                user.setCurrency("USD");
        }

        @Test
        void updateTransaction_budgetReassignment_updatesBudgetCategoryAndSpent() {
                // Given existing transaction in Budget A (Groceries)
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setLimit(500.0);
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Budget budgetB = new Budget();
                budgetB.setId("budget-b");
                budgetB.setCategory("Shopping");
                budgetB.setLimit(300.0);
                budgetB.setSpent(20.0);
                budgetB.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetB.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setOriginalAmount(50.0);
                existing.setOriginalCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-b", "user-123")).thenReturn(Optional.of(budgetB));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                // Reassign to Budget B with category omitted
                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, null, null, null, null, "budget-b", null, null, null);

                TransactionDataResponse response = transactionService.updateTransaction(authUser, "tx-1", request);

                // Verify budget reassignment and category synchronization
                assertEquals("budget-b", existing.getBudget().getId());
                assertEquals("Shopping", existing.getCategory());
                assertEquals(0.0, budgetA.getSpent(), 0.001);
                assertEquals(70.0, budgetB.getSpent(), 0.001);

                verify(budgetRepository).save(budgetA);
                verify(budgetRepository).save(budgetB);
                verify(transactionRepository).save(existing);

                // Verify DTO contains both budgetId and category
                assertNotNull(response.data());
                assertNotNull(response.data().transaction());
                assertEquals("budget-b", response.data().transaction().budgetId());
                assertEquals("Shopping", response.data().transaction().category());
                assertEquals("budget-b", response.data().transaction().budget().id());

                // Verify cache invalidation (evicted for both old date and updated date)
                verify(cacheInvalidator, org.mockito.Mockito.times(2)).evictFinancialSummaryForDate(eq("user-123"),
                                any(Instant.class));
                verify(cacheInvalidator).evictRecurringPayments("user-123");
        }

        @Test
        void updateTransaction_budgetReassignmentWithExplicitCategory_preservesExplicitCategory() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Budget budgetB = new Budget();
                budgetB.setId("budget-b");
                budgetB.setCategory("Shopping");
                budgetB.setSpent(20.0);
                budgetB.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetB.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-b", "user-123")).thenReturn(Optional.of(budgetB));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, "Custom Shopping", null, null, null, "budget-b", null, null, null);

                TransactionDataResponse response = transactionService.updateTransaction(authUser, "tx-1", request);

                assertEquals("budget-b", existing.getBudget().getId());
                assertEquals("Custom Shopping", existing.getCategory());
                assertEquals("Custom Shopping", response.data().transaction().category());
        }

        @Test
        void updateTransaction_budgetFromDifferentMonth_throwsNotFound() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                // Budget from April 2026
                Budget aprilBudget = new Budget();
                aprilBudget.setId("budget-april");
                aprilBudget.setCategory("Groceries");
                aprilBudget.setSpent(0.0);
                aprilBudget.setDate(Instant.parse("2026-04-01T00:00:00Z"));
                aprilBudget.setUser(user);

                // Transaction dated in March 2026
                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-april", "user-123"))
                                .thenReturn(Optional.of(aprilBudget));

                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, null, null, null, null, "budget-april", null, null, null);

                ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                                () -> transactionService.updateTransaction(authUser, "tx-1", request));
                assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        }

        @Test
        void updateTransaction_budgetNotOwnedByUser_throwsNotFound() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setType(TransactionType.EXPENSE);
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                // Foreign budget lookup returns empty for this user
                when(budgetRepository.findByIdAndUser_Id("other-user-budget", "user-123")).thenReturn(Optional.empty());

                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, null, null, null, null, "other-user-budget", null, null, null);

                ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                                () -> transactionService.updateTransaction(authUser, "tx-1", request));
                assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        }

        @Test
        void updateTransaction_existingFieldsUpdated_preservesBudgetAndAppliesDiff() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-a", "user-123")).thenReturn(Optional.of(budgetA));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                // Amount increased from 50 to 75, name changed
                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                "Super Walmart", null, null, null, 75.0, "Weekly groceries", null, null, null, null);

                TransactionDataResponse response = transactionService.updateTransaction(authUser, "tx-1", request);

                assertEquals("Super Walmart", existing.getName());
                assertEquals(75.0, existing.getAmount());
                assertEquals("Weekly groceries", existing.getDescription());
                assertEquals("budget-a", existing.getBudget().getId());
                assertEquals("Groceries", existing.getCategory());
                // 50.0 + (75.0 - 50.0) = 75.0
                assertEquals(75.0, budgetA.getSpent(), 0.001);
                verify(budgetRepository).save(budgetA);
        }
}
