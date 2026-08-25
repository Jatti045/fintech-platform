package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.budget.ApplyBudgetSuggestionsResponse;
import com.fintechapp.fintech_api.dto.budget.ApplySuggestionsRequest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BudgetServiceApplySuggestionsTest {

    private BudgetRepository budgetRepository;
    private TransactionRepository transactionRepository;
    private UserRepository userRepository;
    private BudgetService service;

    private final User user = new User();
    private final AuthenticatedUser auth = new AuthenticatedUser("user-1", "user-1", 0L);

    @BeforeEach
    void setUp() {
        budgetRepository = mock(BudgetRepository.class);
        transactionRepository = mock(TransactionRepository.class);
        userRepository = mock(UserRepository.class);
        service = new BudgetService(budgetRepository, transactionRepository, userRepository);

        user.setId("user-1");
        lenient().when(userRepository.findById("user-1")).thenReturn(Optional.of(user));
    }

    private Budget budget(String category, double limit, boolean autoCreated, double spent) {
        Budget b = new Budget();
        b.setId("id-" + category.toLowerCase());
        b.setUser(user);
        b.setCategory(category);
        b.setLimit(limit);
        b.setAutoCreated(autoCreated);
        b.setSpent(spent);
        b.setDate(Instant.ofEpochMilli(0)); // filler; service resolves spent independently
        return b;
    }

    private ApplySuggestionsRequest request(int month, ApplySuggestionsRequest.Item... items) {
        return new ApplySuggestionsRequest(month, 2026, List.of(items));
    }

    @Test
    void apply_createsMissingBudgets() {
        when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        eq("user-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(i -> i.getArgument(0));

        ApplyBudgetSuggestionsResponse resp = service.applyBudgetSuggestions(
                auth, request(7, new ApplySuggestionsRequest.Item("Food", 300.0)));

        assertTrue(resp.success());
        assertEquals(1, resp.data().created());
        assertEquals(1, resp.data().budgets().size());
        assertEquals("Food", resp.data().budgets().get(0).category());
    }

    @Test
    void apply_setsLimitOnAutoCreated_clearsFlag_preservesSpent() {
        Budget placeholder = budget("Food", 0, true, 42);
        when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        eq("user-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(placeholder));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(i -> i.getArgument(0));

        ApplyBudgetSuggestionsResponse resp = service.applyBudgetSuggestions(
                auth, request(7, new ApplySuggestionsRequest.Item("food", 90.0)));

        assertEquals(0, resp.data().created());
        assertEquals(1, resp.data().updated());
        assertFalse(placeholder.isAutoCreated());
        assertEquals(90.0, placeholder.getLimit());
        assertEquals(42.0, placeholder.getSpent(), 0.0001); // preserved
    }

    @Test
    void apply_neverOverwritesManualBudget_reportsSkipped() {
        Budget inTarget = budget("Food", 500, false, 0);
        when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        eq("user-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(inTarget));

        ApplyBudgetSuggestionsResponse resp = service.applyBudgetSuggestions(
                auth, request(7, new ApplySuggestionsRequest.Item("Food", 90.0)));

        assertEquals(0, resp.data().created());
        assertEquals(0, resp.data().updated());
        assertEquals(1, resp.data().skipped());
        assertEquals("ALREADY_BUDGETED", resp.data().skippedItems().get(0).reason());
        assertEquals(500.0, inTarget.getLimit(), 0.0001); // untouched
    }

    @Test
    void apply_isIdempotent_secondCallProducesAllSkipped() {
        // First call has no budgets → creates; the created budget becomes visible
        // to a second (identical) call, which then skips as ALREADY_BUDGETED.
        java.util.concurrent.atomic.AtomicReference<Budget> created =
                new java.util.concurrent.atomic.AtomicReference<>();
        when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        eq("user-1"), any(Instant.class), any(Instant.class)))
                .thenAnswer(invocation -> created.get() == null
                        ? List.of()
                        : List.of(created.get()));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(invocation -> {
            Budget b = invocation.getArgument(0);
            created.set(b);
            return b;
        });

        ApplySuggestionsRequest req = request(7, new ApplySuggestionsRequest.Item("Food", 300.0));
        ApplyBudgetSuggestionsResponse first = service.applyBudgetSuggestions(auth, req);
        ApplyBudgetSuggestionsResponse second = service.applyBudgetSuggestions(auth, req);

        assertEquals(1, first.data().created());
        assertTrue(second.data().skipped() == 1);
        assertEquals(0, second.data().created());
        assertEquals(0, second.data().updated());
        assertEquals(300.0, created.get().getLimit(), 0.0001);
    }

    @Test
    void apply_deduplicatesCategoriesWithinOneRequest() {
        when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        eq("user-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(i -> i.getArgument(0));

        ApplyBudgetSuggestionsResponse resp = service.applyBudgetSuggestions(auth,
                request(7,
                        new ApplySuggestionsRequest.Item("Food", 100.0),
                        new ApplySuggestionsRequest.Item("food", 200.0)));

        assertEquals(1, resp.data().created());
        assertEquals(1, resp.data().skipped());
        assertEquals("DUPLICATE_CATEGORY", resp.data().skippedItems().get(0).reason());
    }

    @Test
    void apply_throwsWhenPersistFails() {
        when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        any(), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        when(budgetRepository.save(any(Budget.class)))
                .thenThrow(new IllegalStateException("db down"));

        assertThrows(IllegalStateException.class, () -> service.applyBudgetSuggestions(
                auth, request(7, new ApplySuggestionsRequest.Item("Food", 100.0))));
    }
}