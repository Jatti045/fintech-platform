package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest;
import com.fintechapp.fintech_api.dto.transaction.DeleteTransactionResponse;
import com.fintechapp.fintech_api.dto.transaction.TransactionDataResponse;
import com.fintechapp.fintech_api.dto.transaction.TransactionQueryParams;
import com.fintechapp.fintech_api.dto.transaction.TransactionsResponse;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Goal;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.GoalRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;

import jakarta.persistence.criteria.Predicate;

@Service
public class TransactionService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 20;
    private static final String DEFAULT_BASE_CURRENCY = "USD";

    private final BudgetRepository budgetRepository;
    private final GoalRepository goalRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public TransactionService(
            BudgetRepository budgetRepository,
            GoalRepository goalRepository,
            TransactionRepository transactionRepository,
            UserRepository userRepository) {
        this.budgetRepository = budgetRepository;
        this.goalRepository = goalRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    /**
     * Returns paginated transactions for the authenticated user with optional
     * filters. Financial aggregates are handled by {@link FinancialSummaryService}.
     */
    @Transactional(readOnly = true)
    public TransactionsResponse getTransactions(AuthenticatedUser authenticatedUser, TransactionQueryParams params) {
        String userId = requireUserId(authenticatedUser);

        int pageNum = normalizePage(params.page());
        int limitNum = normalizeLimit(params.limit());

        Specification<Transaction> spec = Specification.where(userIdEquals(userId));

        String normalizedType = normalizeOptional(params.type());
        if (StringUtils.hasText(normalizedType)) {
            TransactionType transactionType = parseType(normalizedType);
            spec = spec.and(typeEquals(transactionType));
        }

        String category = normalizeOptional(params.category());
        if (StringUtils.hasText(category)) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category"), category));
        }

        String budgetId = normalizeOptional(params.budgetId());
        if (StringUtils.hasText(budgetId)) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("budget").get("id"), budgetId));
        }

        String goalId = normalizeOptional(params.goalId());
        if (StringUtils.hasText(goalId)) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("goal").get("id"), goalId));
        }

        spec = applyCurrentMonthYearFilter(spec, params.currentMonth(), params.currentYear());

        String searchQuery = normalizeOptional(params.searchQuery());
        if (StringUtils.hasText(searchQuery)) {
            spec = spec.and(searchMatches(searchQuery));
        }

        PageRequest pageRequest = PageRequest.of(pageNum - 1, limitNum, Sort.by(Sort.Direction.DESC, "date"));
        List<Transaction> transactions = transactionRepository.findAll(spec, pageRequest).getContent();
        long totalCount = transactionRepository.count(spec);

        int totalPages = (int) Math.ceil(totalCount / (double) limitNum);

        TransactionsResponse.Data data = new TransactionsResponse.Data(
                transactions.stream().map(this::toItem).toList(),
                new TransactionsResponse.Pagination(
                        pageNum,
                        totalPages,
                        totalCount,
                        pageNum < totalPages,
                        pageNum > 1,
                        limitNum),
                new TransactionsResponse.Filters(
                        normalizedType,
                        category,
                        normalizeOptional(params.startDate()),
                        normalizeOptional(params.endDate()),
                        budgetId,
                        goalId));

        return new TransactionsResponse(true, "Transactions retrieved successfully", data);
    }

    /**
     * Creates a transaction and updates related budget/goal aggregates atomically.
     */
    @Transactional
    public TransactionDataResponse createTransaction(
            AuthenticatedUser authenticatedUser,
            CreateTransactionRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        if (!StringUtils.hasText(request.name())
                || !StringUtils.hasText(request.date())
                || !StringUtils.hasText(request.category())
                || !StringUtils.hasText(request.type())
                || request.amount() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Missing required fields: name, date, category, type, and amount are required");
        }

        if (request.amount() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be a positive number");
        }

        Instant transactionDate = parseTransactionDate(request.date());
        TransactionType type = parseType(request.type());

        int month = request.month() != null
                ? request.month()
                : LocalDate.ofInstant(transactionDate, ZoneOffset.UTC).getMonthValue() - 1;
        int year = request.year() != null
                ? request.year()
                : LocalDate.ofInstant(transactionDate, ZoneOffset.UTC).getYear();

        Instant monthStart = monthStart(year, month);
        Instant nextMonthStart = nextMonthStart(year, month);

        // Expense transactions must be linked to a budget; income transactions
        // may stand alone (money coming in, not spending against a budget).
        boolean isExpense = type == TransactionType.EXPENSE;
        Budget budget = null;
        if (StringUtils.hasText(request.budgetId())) {
            budget = budgetRepository.findByIdAndUser_Id(request.budgetId().trim(), userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Budget not found or doesn't belong to user"));

            Instant budgetDate = budget.getDate();
            if (budgetDate.isBefore(monthStart) || !budgetDate.isBefore(nextMonthStart)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Budget not found or doesn't belong to user");
            }
        } else if (isExpense) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "budgetId is required for expense transactions");
        }

        Goal goal = null;
        if (StringUtils.hasText(request.goalId())) {
            goal = goalRepository.findByIdAndUser_Id(request.goalId().trim(), userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Goal not found or doesn't belong to user"));
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));

        String baseCurrency = normalizeCurrency(request.baseCurrency());
        if (!StringUtils.hasText(baseCurrency)) {
            baseCurrency = normalizeCurrency(user.getCurrency());
        }
        if (!StringUtils.hasText(baseCurrency)) {
            baseCurrency = DEFAULT_BASE_CURRENCY;
        }

        String originalCurrency = normalizeCurrency(request.originalCurrency());
        if (!StringUtils.hasText(originalCurrency)) {
            originalCurrency = baseCurrency;
        }

        Double originalAmount = request.originalAmount();
        if (originalAmount == null) {
            originalAmount = request.amount();
        }
        if (originalAmount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "originalAmount must be a positive number");
        }

        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setName(request.name().trim());
        transaction.setDate(transactionDate);
        transaction.setCategory(request.category().trim());
        transaction.setType(type);
        transaction.setAmount(request.amount());
        transaction.setBaseCurrency(baseCurrency);
        transaction.setOriginalCurrency(originalCurrency);
        transaction.setOriginalAmount(originalAmount);
        transaction.setDescription(normalizeOptional(request.description()));
        transaction.setBudget(budget);
        transaction.setGoal(goal);

        Transaction saved = transactionRepository.save(transaction);

        if (saved.getType() == TransactionType.EXPENSE) {
            budget.setSpent(budget.getSpent() + saved.getAmount());
            budgetRepository.save(budget);
        }

        if (saved.getGoal() != null && saved.getType() == TransactionType.INCOME) {
            Goal linkedGoal = saved.getGoal();
            linkedGoal.setProgress(linkedGoal.getProgress() + saved.getAmount());
            goalRepository.save(linkedGoal);
        }

        return new TransactionDataResponse(
                true,
                "Transaction created successfully",
                new TransactionDataResponse.Data(toItem(saved)));
    }

    /**
     * Deletes a transaction and restores related budget/goal aggregates atomically.
     */
    @Transactional
    public DeleteTransactionResponse deleteTransaction(AuthenticatedUser authenticatedUser, String transactionId) {
        String userId = requireUserId(authenticatedUser);
        if (!StringUtils.hasText(transactionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction ID is required");
        }

        Transaction existing = transactionRepository.findByIdAndUser_Id(transactionId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Transaction not found or doesn't belong to user"));

        Budget budget = existing.getBudget();
        Goal goal = existing.getGoal();
        double amount = existing.getAmount();
        TransactionType type = existing.getType();

        if (budget != null && type == TransactionType.EXPENSE) {
            budget.setSpent(budget.getSpent() - amount);
            budgetRepository.save(budget);
        }

        if (goal != null && type == TransactionType.INCOME) {
            goal.setProgress(goal.getProgress() - amount);
            goalRepository.save(goal);
        }

        transactionRepository.delete(existing);

        DeleteTransactionResponse.RestoredBudget restoredBudget = budget != null
                ? new DeleteTransactionResponse.RestoredBudget(
                        budget.getId(),
                        type == TransactionType.EXPENSE ? amount : 0)
                : null;

        DeleteTransactionResponse.RestoredGoal restoredGoal = goal != null
                ? new DeleteTransactionResponse.RestoredGoal(
                        goal.getId(),
                        type == TransactionType.INCOME ? amount : 0)
                : null;

        return new DeleteTransactionResponse(
                true,
                "Transaction deleted successfully",
                new DeleteTransactionResponse.Data(existing.getId(), restoredBudget, restoredGoal));
    }

    /**
     * Updates a transaction and synchronizes related budget/goal aggregates
     * atomically.
     */
    @Transactional
    public TransactionDataResponse updateTransaction(
            AuthenticatedUser authenticatedUser,
            String transactionId,
            UpdateTransactionRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (!StringUtils.hasText(transactionId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction ID is required");
        }
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        Transaction existing = transactionRepository.findByIdAndUser_Id(transactionId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Transaction not found or doesn't belong to user"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));

        TransactionType newType = request.type() != null ? parseType(request.type()) : existing.getType();

        double newAmount = existing.getAmount();
        if (request.amount() != null) {
            if (request.amount() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be a positive number");
            }
            newAmount = request.amount();
        }

        Instant newDate = existing.getDate();
        if (StringUtils.hasText(request.date())) {
            newDate = parseTransactionDate(request.date());
        }

        String newBudgetId;
        if (request.budgetId() == null) {
            newBudgetId = existing.getBudget() != null ? existing.getBudget().getId() : null;
        } else {
            newBudgetId = StringUtils.hasText(request.budgetId()) ? request.budgetId().trim() : null;
        }

        // Expense transactions must always resolve to a budget; income may keep null.
        Budget newBudget = null;
        if (newType == TransactionType.EXPENSE) {
            if (!StringUtils.hasText(newBudgetId)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "budgetId is required for expense transactions");
            }
            newBudget = budgetRepository.findByIdAndUser_Id(newBudgetId, userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Budget not found or doesn't belong to user"));

            // The linked budget must belong to the transaction's month so budget
            // spent totals stay scoped to the correct month (mirrors
            // createTransaction, which validates the same invariant).
            LocalDate txMonth = LocalDate.ofInstant(newDate, ZoneOffset.UTC);
            Instant effectiveMonthStart = monthStart(txMonth.getYear(), txMonth.getMonthValue() - 1);
            Instant effectiveNextMonthStart = nextMonthStart(txMonth.getYear(), txMonth.getMonthValue() - 1);
            Instant budgetDate = newBudget.getDate();
            if (budgetDate.isBefore(effectiveMonthStart) || !budgetDate.isBefore(effectiveNextMonthStart)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Budget not found or doesn't belong to user");
            }
        }

        String newGoalId = request.goalId() == null
                ? (existing.getGoal() != null ? existing.getGoal().getId() : null)
                : normalizeOptional(request.goalId());

        Goal newGoal = null;
        if (StringUtils.hasText(newGoalId)) {
            newGoal = goalRepository.findByIdAndUser_Id(newGoalId, userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Goal not found or doesn't belong to user"));
        }

        Budget oldBudget = existing.getBudget();
        Goal oldGoal = existing.getGoal();
        double oldAmount = existing.getAmount();
        TransactionType oldType = existing.getType();

        if (oldBudget != null && oldType == TransactionType.EXPENSE) {
            if (newType != TransactionType.EXPENSE
                    || newBudget == null
                    || !oldBudget.getId().equals(newBudget.getId())) {
                oldBudget.setSpent(oldBudget.getSpent() - oldAmount);
                budgetRepository.save(oldBudget);
            } else {
                double diff = newAmount - oldAmount;
                if (diff != 0) {
                    oldBudget.setSpent(oldBudget.getSpent() + diff);
                    budgetRepository.save(oldBudget);
                }
            }
        }

        if (newType == TransactionType.EXPENSE
                && newBudget != null
                && (oldBudget == null || !oldBudget.getId().equals(newBudget.getId()))) {
            newBudget.setSpent(newBudget.getSpent() + newAmount);
            budgetRepository.save(newBudget);
        }

        if (oldGoal != null && oldType == TransactionType.INCOME) {
            if (newGoal == null || !oldGoal.getId().equals(newGoal.getId()) || newType != TransactionType.INCOME) {
                oldGoal.setProgress(oldGoal.getProgress() - oldAmount);
                goalRepository.save(oldGoal);
            } else {
                double diff = newAmount - oldAmount;
                if (diff != 0) {
                    oldGoal.setProgress(oldGoal.getProgress() + diff);
                    goalRepository.save(oldGoal);
                }
            }
        }

        if (newGoal != null && newType == TransactionType.INCOME
                && (oldGoal == null || !oldGoal.getId().equals(newGoal.getId()))) {
            newGoal.setProgress(newGoal.getProgress() + newAmount);
            goalRepository.save(newGoal);
        }

        if (request.name() != null) {
            existing.setName(request.name().trim());
        }
        if (request.date() != null) {
            existing.setDate(newDate);
        }
        if (request.category() != null) {
            existing.setCategory(request.category().trim());
        }
        if (request.type() != null) {
            existing.setType(newType);
        }
        if (request.amount() != null) {
            existing.setAmount(newAmount);
        }
        if (request.description() != null) {
            existing.setDescription(normalizeOptional(request.description()));
        }

        String resolvedBaseCurrency = request.baseCurrency() != null
                ? normalizeCurrency(request.baseCurrency())
                : normalizeCurrency(existing.getBaseCurrency());
        if (!StringUtils.hasText(resolvedBaseCurrency)) {
            resolvedBaseCurrency = normalizeCurrency(user.getCurrency());
        }
        if (!StringUtils.hasText(resolvedBaseCurrency)) {
            resolvedBaseCurrency = DEFAULT_BASE_CURRENCY;
        }

        String resolvedOriginalCurrency = request.originalCurrency() != null
                ? normalizeCurrency(request.originalCurrency())
                : normalizeCurrency(existing.getOriginalCurrency());
        Double resolvedOriginalAmount = request.originalAmount() != null
                ? request.originalAmount()
                : existing.getOriginalAmount();

        // If amount changed but no original snapshot provided, treat current amount
        // as the original amount in base currency.
        if (request.amount() != null && request.originalAmount() == null && request.originalCurrency() == null) {
            resolvedOriginalAmount = newAmount;
            resolvedOriginalCurrency = resolvedBaseCurrency;
        }

        if (resolvedOriginalAmount == null) {
            resolvedOriginalAmount = newAmount;
        }
        if (!StringUtils.hasText(resolvedOriginalCurrency)) {
            resolvedOriginalCurrency = resolvedBaseCurrency;
        }
        if (resolvedOriginalAmount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "originalAmount must be a positive number");
        }

        existing.setBaseCurrency(resolvedBaseCurrency);
        existing.setOriginalCurrency(resolvedOriginalCurrency);
        existing.setOriginalAmount(resolvedOriginalAmount);

        existing.setBudget(newBudget);
        existing.setGoal(newGoal);

        Transaction updated = transactionRepository.save(existing);

        return new TransactionDataResponse(
                true,
                "Transaction updated successfully",
                new TransactionDataResponse.Data(toItem(updated)));
    }

    private TransactionsResponse.TransactionItem toItem(Transaction transaction) {
        Budget budget = transaction.getBudget();
        Goal goal = transaction.getGoal();

        TransactionsResponse.BudgetInfo budgetInfo = budget == null
                ? null
                : new TransactionsResponse.BudgetInfo(
                        budget.getId(),
                        budget.getCategory(),
                        budget.getLimit(),
                        budget.getSpent());

        TransactionsResponse.GoalInfo goalInfo = goal == null
                ? null
                : new TransactionsResponse.GoalInfo(
                        goal.getId(),
                        goal.getTarget(),
                        goal.getProgress());

        return new TransactionsResponse.TransactionItem(
                transaction.getId(),
                transaction.getName(),
                transaction.getDate(),
                transaction.getCategory(),
                transaction.getType(),
                transaction.getAmount(),
                transaction.getBaseCurrency(),
                transaction.getOriginalAmount(),
                transaction.getOriginalCurrency(),
                transaction.getDescription(),
                budgetInfo,
                goalInfo);
    }

    private Specification<Transaction> userIdEquals(String userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    private Specification<Transaction> typeEquals(TransactionType type) {
        return (root, query, cb) -> cb.equal(root.get("type"), type);
    }

    private Specification<Transaction> searchMatches(String rawSearchQuery) {
        String search = "%" + rawSearchQuery.toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> {
            Predicate nameMatch = cb.like(cb.lower(root.get("name")), search);
            Predicate descriptionMatch = cb.like(cb.lower(cb.coalesce(root.get("description"), "")), search);
            return cb.or(nameMatch, descriptionMatch);
        };
    }

    private Specification<Transaction> applyCurrentMonthYearFilter(
            Specification<Transaction> base,
            String currentMonthRaw,
            String currentYearRaw) {
        if (currentMonthRaw == null || currentYearRaw == null) {
            return base;
        }

        Integer month = parseInteger(currentMonthRaw);
        Integer year = parseInteger(currentYearRaw);
        if (month == null || year == null || month < 0 || month > 11 || year <= 0) {
            return base;
        }

        Instant from = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant to = LocalDate.of(year, month + 1, 1).plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        return base.and((root, query, cb) -> cb.and(
                cb.greaterThanOrEqualTo(root.get("date"), from),
                cb.lessThan(root.get("date"), to)));
    }

    private String requireUserId(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        return authenticatedUser.userId();
    }

    private int normalizePage(String rawPage) {
        Integer parsed = parseInteger(rawPage);
        return Math.max(DEFAULT_PAGE, parsed == null ? DEFAULT_PAGE : parsed);
    }

    private int normalizeLimit(String rawLimit) {
        Integer parsed = parseInteger(rawLimit);
        int candidate = parsed == null ? DEFAULT_LIMIT : parsed;
        return Math.min(MAX_LIMIT, Math.max(1, candidate));
    }

    private Integer parseInteger(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }

        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private TransactionType parseType(String rawType) {
        try {
            return TransactionType.valueOf(rawType.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid transaction type. Must be either INCOME or EXPENSE");
        }
    }

    private Instant parseTransactionDate(String rawDate) {
        if (!StringUtils.hasText(rawDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format");
        }

        String normalized = rawDate.trim();
        try {
            return Instant.parse(normalized);
        } catch (Exception ignored) {
        }

        try {
            return LocalDate.parse(normalized).atStartOfDay().toInstant(ZoneOffset.UTC);
        } catch (Exception ignored) {
        }

        try {
            return LocalDateTime.parse(normalized).toInstant(ZoneOffset.UTC);
        } catch (Exception ignored) {
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format");
    }

    private Instant monthStart(int year, int month) {
        if (month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
        }
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeCurrency(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
