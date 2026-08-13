package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.budget.BudgetDataResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetIdResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetItemResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetsResponse;
import com.fintechapp.fintech_api.dto.budget.CreateBudgetRequest;
import com.fintechapp.fintech_api.dto.budget.UpdateBudgetRequest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;

@Service
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public BudgetService(
            BudgetRepository budgetRepository,
            TransactionRepository transactionRepository,
            UserRepository userRepository
    ) {
        this.budgetRepository = budgetRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public BudgetDataResponse createBudget(AuthenticatedUser authenticatedUser, CreateBudgetRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category and limit are required");
        }

        Integer month = request.month();
        Integer year = request.year();
        if (month == null || year == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year are required");
        }

        Instant monthStart = monthStart(year, month);
        Instant nextMonthStart = nextMonthStart(year, month);

        if (!StringUtils.hasText(request.category()) || request.limit() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category and limit are required");
        }

        boolean exists = budgetRepository.existsByUser_IdAndCategoryAndDateGreaterThanEqualAndDateLessThan(
                userId,
                request.category().trim(),
                monthStart,
                nextMonthStart
        );

        if (exists) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Budget for this category already exists");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));

        Budget budget = new Budget();
        budget.setUser(user);
        budget.setCategory(request.category().trim());
        budget.setLimit(request.limit());
        budget.setDate(monthStart);
        budget.setAutoCreated(false); // manual budgets always start budgeted

        Budget saved = budgetRepository.save(budget);
        return new BudgetDataResponse(true, "Budget created successfully", toBudgetItem(saved));
    }

    @Transactional(readOnly = true)
    public BudgetsResponse getBudgets(AuthenticatedUser authenticatedUser, String monthRaw, String yearRaw) {
        String userId = requireUserId(authenticatedUser);

        if (monthRaw == null || yearRaw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
        }

        Integer month = parseInteger(monthRaw);
        Integer year = parseInteger(yearRaw);
        if (month == null || year == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
        }

        Instant monthStart = monthStart(year, month);
        Instant nextMonthStart = nextMonthStart(year, month);

        System.out.println(" BUDGET: Month start : " + monthStart + "Next month start : " + nextMonthStart);

        List<BudgetItemResponse> budgets = budgetRepository
                .findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(userId, monthStart, nextMonthStart)
                .stream()
                .map(this::toBudgetItem)
                .toList();

        return new BudgetsResponse(true, "Budgets retrieved successfully", budgets);
    }

    @Transactional
    public BudgetIdResponse deleteBudget(AuthenticatedUser authenticatedUser, String budgetId) {
        String userId = requireUserId(authenticatedUser);

        Budget budget = budgetRepository.findByIdAndUser_Id(budgetId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Budget not found"));

        long attachedCount = transactionRepository.countByBudget_IdAndUser_Id(budgetId, userId);
        if (attachedCount > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot delete budget: there are transactions attached to this budget. Remove or reassign those transactions first."
            );
        }

        budgetRepository.delete(budget);
        return new BudgetIdResponse(true, "Budget deleted successfully", budgetId);
    }

    @Transactional
    public BudgetDataResponse updateBudget(
            AuthenticatedUser authenticatedUser,
            String budgetId,
            UpdateBudgetRequest request
    ) {
        String userId = requireUserId(authenticatedUser);

        if (!StringUtils.hasText(budgetId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budgetId is required");
        }

        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No update payload provided");
        }

        Budget existing = budgetRepository.findByIdAndUser_Id(budgetId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Budget not found or doesn't belong to user"
                ));

        int newMonth = request.month() != null
                ? request.month()
                : LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getMonthValue() - 1;
        int newYear = request.year() != null
                ? request.year()
                : LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getYear();
        String newCategory = request.category() != null
                ? request.category().trim()
                : existing.getCategory();

        boolean categoryOrDateChanged = !newCategory.equals(existing.getCategory())
                || newMonth != LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getMonthValue() - 1
                || newYear != LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getYear();

        if (categoryOrDateChanged) {
            Instant monthStart = monthStart(newYear, newMonth);
            Instant nextMonthStart = nextMonthStart(newYear, newMonth);

            boolean conflict = budgetRepository.existsByUser_IdAndCategoryAndDateGreaterThanEqualAndDateLessThanAndIdNot(
                    userId,
                    newCategory,
                    monthStart,
                    nextMonthStart,
                    budgetId
            );

            if (conflict) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Another budget with this category exists for the same month"
                );
            }
        }

        if (request.limit() != null) {
            if (request.limit() < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be a non-negative number");
            }
            if (request.limit() < existing.getSpent()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Limit cannot be less than current spent amount. Adjust transactions before reducing the limit."
                );
            }
            existing.setLimit(request.limit());
            // Assigning a limit clears the auto-created/unbudgeted flag.
            existing.setAutoCreated(false);
        }

        if (request.category() != null) {
            existing.setCategory(newCategory);
        }

        if (request.month() != null || request.year() != null) {
            existing.setDate(monthStart(newYear, newMonth));
        }

        Budget updated = budgetRepository.save(existing);
        return new BudgetDataResponse(true, "Budget updated successfully", toBudgetItem(updated));
    }

    private BudgetItemResponse toBudgetItem(Budget budget) {
        return new BudgetItemResponse(
                budget.getId(),
                budget.getUser().getId(),
                budget.getDate(),
                budget.getCategory(),
                budget.getLimit(),
                budget.getSpent(),
                budget.isAutoCreated(),
                budget.getCreatedAt(),
                budget.getUpdatedAt()
        );
    }

    private String requireUserId(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return authenticatedUser.userId();
    }

    private Integer parseInteger(String rawValue) {
        try {
            return Integer.parseInt(rawValue);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Instant monthStart(int year, int month) {
        if (month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
        }
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1)
                .plusMonths(1)
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);
    }
}

