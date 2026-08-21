package com.fintechapp.fintech_api.service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Maps raw Plaid transaction payloads onto the app's transaction/budget model.
 *
 * <p>Each inbound transaction is keyed by {@code transaction_id} and written
 * with a single SQL upsert: a new id inserts a row, and an id that already
 * exists locally (e.g. a transaction re-served in Plaid's {@code modified}
 * array) updates the existing row in place. Removed records delete the matching
 * local transaction and restore budget spent aggregates.</p>
 *
 * <p>After a disconnect + reconnect Plaid re-serves the same underlying bank
 * transactions under <b>new</b> {@code transaction_id}s, so they are inserted
 * as-is — the same purchase may appear once per bank connection.</p>
 *
 * <p>The auto-category rule: a transaction's sanitized personal-finance
 * category is looked up against the user's existing monthly budgets (case
 * insensitive). When no budget matches, a new one is created for that month
 * with a default {@code limit = 0} (a zero-budget category), and the
 * transaction is linked to it.</p>
 */
@Service
public class PlaidTransactionIngestService {

    /** A normalized transaction carried from a Plaid /transactions/sync page. */
    public record PlaidTransaction(
            String transactionId,
            String name,
            Instant date,
            String category,
            double amount,
            String isoCurrencyCode,
            String unofficialCurrencyCode) {
    }

    private static final String DEFAULT_BASE_CURRENCY = "USD";

    private static final Logger logger = LoggerFactory.getLogger(PlaidTransactionIngestService.class);

    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final PlaidCategoryFormatter categoryFormatter;
    private final JdbcTemplate jdbcTemplate;

    public PlaidTransactionIngestService(
            TransactionRepository transactionRepository,
            BudgetRepository budgetRepository,
            PlaidCategoryFormatter categoryFormatter,
            JdbcTemplate jdbcTemplate) {
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
        this.categoryFormatter = categoryFormatter;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Creates or updates a transaction for {@code plaidTx}, resolving (and
     * auto-creating if necessary) the user's zero-budget category for the
     * transaction's month.
     *
     * <p>The write is a single SQL upsert keyed on {@code plaid_transaction_id}:
     * a new id inserts a row; a known id (e.g. Plaid's {@code modified} array)
     * updates the existing row in place and reconciles the budget spent
     * aggregate by the amount difference.</p>
     */
    @Transactional
    public void upsertTransaction(User user, PlaidTransaction plaidTx) {
        if (plaidTx == null || !StringUtils.hasText(plaidTx.transactionId())) {
            return;
        }
        insert(user, plaidTx);
    }

    /**
     * Applies a whole {@code /transactions/sync} {@code added} batch.
     */
    @Transactional
    public void upsertAddedBatch(User user, List<PlaidTransaction> added) {
        if (added == null || added.isEmpty()) {
            return;
        }
        for (PlaidTransaction plaidTx : added) {
            upsertTransaction(user, plaidTx);
        }
    }

    /**
     * Removes transactions identified by their Plaid ids and restores the
     * affected budget spent aggregates.
     */
    @Transactional
    public void removeByPlaidIds(List<String> plaidTransactionIds, String userId) {
        if (plaidTransactionIds == null || plaidTransactionIds.isEmpty()) {
            return;
        }
        List<Transaction> transactions =
                transactionRepository.findByPlaidTransactionIdInAndUser_Id(plaidTransactionIds, userId);
        for (Transaction tx : transactions) {
            removeTransaction(tx);
        }
    }

    /**
     * Updates an existing local transaction with the incoming Plaid payload.
     */
    private void applyUpdate(Transaction tx, User user, PlaidTransaction plaidTx) {
        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        double absoluteAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String baseCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        Budget budget = resolveOrCreateBudget(user, category, txDate);

        Budget oldBudget = tx.getBudget();
        double oldAmount = tx.getAmount();
        TransactionType oldType = tx.getType();

        tx.setName(displayName(plaidTx, category));
        tx.setCategory(category);
        tx.setDate(txDate);
        tx.setAmount(absoluteAmount);
        tx.setType(type);
        tx.setBaseCurrency(baseCurrency);
        tx.setOriginalCurrency(baseCurrency);
        tx.setOriginalAmount(absoluteAmount);
        tx.setPlaidTransactionId(plaidTx.transactionId());
        tx.setBudget(budget);
        transactionRepository.save(tx);

        reconcileBudgetOnUpdate(oldBudget, oldAmount, oldType, budget, absoluteAmount, type);
    }

    /**
     * Inserts a new transaction via native {@code INSERT ... ON CONFLICT DO
     * NOTHING}: the database unique index on {@code plaid_transaction_id} is
     * the arbiter between insert and update. A conflict means the row already
     * exists (e.g. a transaction re-served in Plaid's {@code modified} array or
     * a concurrent sync) — it is loaded and reconciled as an update instead.
     */
    private void insert(User user, PlaidTransaction plaidTx) {
        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        double absoluteAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String baseCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        Budget budget = resolveOrCreateBudget(user, category, txDate);

        int inserted = jdbcTemplate.update("""
                INSERT INTO transactions (
                    id, name, transaction_date, category, type, amount,
                    base_currency, original_amount, original_currency,
                    plaid_transaction_id,
                    description, user_id, budget_id, goal_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NOW(), NOW())
                ON CONFLICT DO NOTHING
                """,
                UUID.randomUUID().toString(),
                displayName(plaidTx, category),
                Timestamp.from(txDate),
                category,
                type.name(),
                absoluteAmount,
                baseCurrency,
                absoluteAmount,
                baseCurrency,
                plaidTx.transactionId(),
                user.getId(),
                budget.getId());

        if (inserted == 0) {
            // The row already exists — reconcile it as an update (modified).
            transactionRepository
                    .findByPlaidTransactionIdAndUser_Id(plaidTx.transactionId(), user.getId())
                    .ifPresent(tx -> applyUpdate(tx, user, plaidTx));
            return;
        }

        if (type == TransactionType.EXPENSE) {
            budget.setSpent(budget.getSpent() + absoluteAmount);
            budgetRepository.save(budget);
        }
    }

    private String displayName(PlaidTransaction plaidTx, String formattedCategory) {
        return StringUtils.hasText(plaidTx.name()) ? plaidTx.name().trim() : formattedCategory;
    }

    /** Deletes one transaction and restores its budget spent contribution. */
    private void removeTransaction(Transaction tx) {
        if (tx.getType() == TransactionType.EXPENSE && tx.getBudget() != null) {
            Budget budget = tx.getBudget();
            budget.setSpent(Math.max(0, budget.getSpent() - tx.getAmount()));
            budgetRepository.save(budget);
        }
        transactionRepository.delete(tx);
    }

    /** Resolves the month-scoped budget for a transaction's category. */
    private Budget resolveOrCreateBudget(User user, String category, Instant txDate) {
        LocalDate localDate = LocalDate.ofInstant(txDate, ZoneOffset.UTC);
        int year = localDate.getYear();
        int monthIndex = localDate.getMonthValue() - 1;
        return resolveOrCreateBudget(user, category, monthStart(year, monthIndex), nextMonthStart(year, monthIndex));
    }

    private Budget resolveOrCreateBudget(User user, String category, Instant monthStart, Instant nextMonthStart) {
        Optional<Budget> existing = budgetRepository
                .findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        user.getId(), category, monthStart, nextMonthStart);
        if (existing.isPresent()) {
            return existing.get();
        }

        Budget created = new Budget();
        created.setUser(user);
        created.setCategory(category);
        created.setLimit(0); // auto-created "Category" starts with a default zero budget
        created.setDate(monthStart);
        created.setAutoCreated(true); // flag as unbudgeted until the user assigns a limit
        // Flush immediately so the native transaction INSERT below can reference
        // the budget_id foreign key within the same database transaction.
        return budgetRepository.saveAndFlush(created);
    }

    /** Mirrors the spending reconciliation in {@code TransactionService.updateTransaction}. */
    private void reconcileBudgetOnUpdate(
            Budget oldBudget,
            double oldAmount,
            TransactionType oldType,
            Budget newBudget,
            double newAmount,
            TransactionType newType) {
        boolean sameBudget = oldBudget != null && newBudget != null && oldBudget.getId().equals(newBudget.getId());

        if (newType == TransactionType.EXPENSE) {
            if (oldType == TransactionType.EXPENSE && !sameBudget) {
                oldBudget.setSpent(Math.max(0, oldBudget.getSpent() - oldAmount));
                budgetRepository.save(oldBudget);
            }
            if (!sameBudget) {
                newBudget.setSpent(newBudget.getSpent() + newAmount);
                budgetRepository.save(newBudget);
            } else {
                double diff = newAmount - oldAmount;
                if (diff != 0.0) {
                    newBudget.setSpent(newBudget.getSpent() + diff);
                    budgetRepository.save(newBudget);
                }
            }
        } else if (oldType == TransactionType.EXPENSE) {
            oldBudget.setSpent(Math.max(0, oldBudget.getSpent() - oldAmount));
            budgetRepository.save(oldBudget);
        }
    }

    private String resolveCurrency(String isoCurrencyCode, String unofficialCurrencyCode, User user) {
        String resolved = StringUtils.hasText(isoCurrencyCode)
                ? isoCurrencyCode
                : unofficialCurrencyCode;
        if (StringUtils.hasText(resolved)) {
            return resolved.trim().toUpperCase(Locale.ROOT);
        }
        if (StringUtils.hasText(user.getCurrency())) {
            return user.getCurrency().trim().toUpperCase(Locale.ROOT);
        }
        return DEFAULT_BASE_CURRENCY;
    }

    private Instant monthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}