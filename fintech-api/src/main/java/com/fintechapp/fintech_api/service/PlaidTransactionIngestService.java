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
 * <p>
 * Each inbound transaction is keyed by {@code transaction_id} and written
 * with a single SQL upsert: a new id inserts a row, and an id that already
 * exists locally (e.g. a transaction re-served in Plaid's {@code modified}
 * array) updates the existing row in place. Removed records delete the matching
 * local transaction and restore budget spent aggregates.
 * </p>
 *
 * <p>
 * After a disconnect + reconnect Plaid re-serves the same underlying bank
 * transactions under <b>new</b> {@code transaction_id}s, so they are inserted
 * as-is — the same purchase may appear once per bank connection.
 * </p>
 *
 * <p>
 * The auto-category rule: a transaction's sanitized personal-finance
 * category is looked up against the user's existing monthly budgets (case
 * insensitive). When no budget matches, a new one is created for that month
 * with a default {@code limit = 0} (a zero-budget category), and the
 * transaction is linked to it.
 * </p>
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
            boolean transfer,
            String isoCurrencyCode,
            String unofficialCurrencyCode,
            String plaidAccountId,
            String plaidItemId,
            String plaidPfcDetailed,
            Boolean pending,
            String pendingTransactionId,
            LocalDate postedDate) {
        public PlaidTransaction(String transactionId, String name, Instant date, String category,
                double amount, boolean transfer, String isoCurrencyCode, String unofficialCurrencyCode,
                String plaidAccountId, String plaidItemId, String plaidPfcDetailed) {
            this(transactionId, name, date, category, amount, transfer, isoCurrencyCode,
                    unofficialCurrencyCode, plaidAccountId, plaidItemId, plaidPfcDetailed, null, null, null);
        }
    }

    private static final String DEFAULT_BASE_CURRENCY = "USD";

    private static final Logger logger = LoggerFactory.getLogger(PlaidTransactionIngestService.class);

    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final PlaidCategoryFormatter categoryFormatter;
    private final JdbcTemplate jdbcTemplate;
    private final CurrencyConversionService currencyConversionService;

    public PlaidTransactionIngestService(
            TransactionRepository transactionRepository,
            BudgetRepository budgetRepository,
            PlaidCategoryFormatter categoryFormatter,
            JdbcTemplate jdbcTemplate,
            CurrencyConversionService currencyConversionService) {
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
        this.categoryFormatter = categoryFormatter;
        this.jdbcTemplate = jdbcTemplate;
        this.currencyConversionService = currencyConversionService;
    }

    /**
     * Creates or updates a transaction for {@code plaidTx}, resolving (and
     * auto-creating if necessary) the user's zero-budget category for the
     * transaction's month.
     *
     * <p>
     * The write is a single SQL upsert keyed on {@code plaid_transaction_id}:
     * a new id inserts a row; a known id (e.g. Plaid's {@code modified} array)
     * updates the existing row in place and reconciles the budget spent
     * aggregate by the amount difference.
     * </p>
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
        List<Transaction> transactions = transactionRepository.findByPlaidTransactionIdInAndUser_Id(plaidTransactionIds,
                userId);
        for (Transaction tx : transactions) {
            removeTransaction(tx);
        }
    }

    /**
     * Updates an existing local transaction with the incoming Plaid payload.
     *
     * <p>
     * Transfers never contribute to budget spent aggregates: when a row
     * becomes a transfer its previous budget contribution is restored, and when
     * a row stops being a transfer the full amount is added to the resolved
     * budget (the old transfer row had no contribution).
     * </p>
     */
    private void applyUpdate(Transaction tx, User user, PlaidTransaction plaidTx) {
        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        double originalAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String originalCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        String baseCurrency = aggregationCurrency(user);
        double absoluteAmount = currencyConversionService.convert(originalAmount, originalCurrency, baseCurrency);

        // Classification is derived after the complete page, not reset by raw mapping.
        boolean incomingTransfer = tx.isTransfer() || plaidTx.transfer();
        boolean wasTransfer = tx.isTransfer();
        Budget oldBudget = tx.getBudget();
        double oldAmount = tx.getAmount();
        TransactionType oldType = tx.getType();

        tx.setName(displayName(plaidTx, category));
        tx.setCategory(category);
        tx.setDate(txDate);
        tx.setAmount(absoluteAmount);
        tx.setType(type);
        tx.setBaseCurrency(baseCurrency);
        tx.setOriginalCurrency(originalCurrency);
        tx.setOriginalAmount(originalAmount);
        tx.setPlaidTransactionId(plaidTx.transactionId());
        tx.setPlaidAccountId(plaidTx.plaidAccountId());
        tx.setPlaidItemId(plaidTx.plaidItemId());
        tx.setPlaidPfcDetailed(plaidTx.plaidPfcDetailed());
        tx.setPlaidPending(plaidTx.pending());
        tx.setPlaidPendingTransactionId(plaidTx.pendingTransactionId());
        tx.setPlaidPostedDate(plaidTx.postedDate());
        tx.setTransfer(incomingTransfer);

        if (incomingTransfer) {
            // A transfer is movement of existing money — it must not count
            // toward any budget. Restore the contribution if the row previously
            // was a budgeted expense. Atomic, zero-floored decrement.
            if (!wasTransfer && oldBudget != null && oldType == TransactionType.EXPENSE) {
                budgetRepository.decrementSpentClamped(oldBudget.getId(), oldAmount);
            }
            tx.setBudget(null);
            transactionRepository.save(tx);
            if (wasTransfer && oldBudget != null) {
                // A legacy manual edit may have linked an excluded transfer to a
                // budget. Rebuild before losing that old link during the upsert.
                budgetRepository.recalculateSpent(oldBudget.getId());
            }
            return;
        }

        // Income is not a budgeted activity: it must never create or attach
        // to a budget. Only expenses participate in budget tracking.
        // (Transfers were already handled above.)
        if (type == TransactionType.EXPENSE) {
            Budget budget = resolveOrCreateBudget(user, category, txDate);
            tx.setBudget(budget);
            transactionRepository.save(tx);

            if (wasTransfer) {
                // Previously a transfer with no budget contribution; the full
                // amount is now real activity. Atomic database-side increment.
                budgetRepository.incrementSpent(budget.getId(), absoluteAmount);
                return;
            }
            reconcileBudgetOnUpdate(oldBudget, oldAmount, oldType, budget, absoluteAmount, type);
        } else {
            // Income: detach from any budget it may previously have been
            // assigned to (e.g. rows written by the old behaviour).
            tx.setBudget(null);
            transactionRepository.save(tx);
            // If this row was previously a budgeted expense, its contribution
            // must be removed from the old budget's spent aggregate.
            reconcileBudgetOnUpdate(oldBudget, oldAmount, oldType, null, absoluteAmount, type);
        }
    }

    /**
     * Inserts a new transaction via native {@code INSERT ... ON CONFLICT DO
     * NOTHING}: the database unique index on {@code plaid_transaction_id} is
     * the arbiter between insert and update. A conflict means the row already
     * exists (e.g. a transaction re-served in Plaid's {@code modified} array or
     * a concurrent sync) — it is loaded and reconciled as an update instead.
     *
     * <p>
     * Transfer transactions are stored without a budget link and never
     * increment budget spent.
     * </p>
     */
    private void insert(User user, PlaidTransaction plaidTx) {
        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        double originalAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String originalCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        String baseCurrency = aggregationCurrency(user);
        double absoluteAmount = currencyConversionService.convert(originalAmount, originalCurrency, baseCurrency);
        boolean transfer = plaidTx.transfer();
        // Income is not a budgeted activity: it must never create or attach
        // to a budget. Only expenses participate in budget tracking.
        Budget budget =
            transfer || type == TransactionType.INCOME
                ? null
                : resolveOrCreateBudget(user, category, txDate);

        int inserted = jdbcTemplate.update("""
                INSERT INTO transactions (
                    id, name, transaction_date, category, type, amount,
                    base_currency, original_amount, original_currency,
                    plaid_transaction_id, plaid_account_id, plaid_item_id, is_transfer,
                    plaid_pfc_detailed, plaid_pending, plaid_pending_transaction_id, plaid_posted_date, description, user_id, budget_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NOW(), NOW())
                ON CONFLICT DO NOTHING
                """,
                UUID.randomUUID().toString(),
                displayName(plaidTx, category),
                Timestamp.from(txDate),
                category,
                type.name(),
                absoluteAmount,
                baseCurrency,
                originalAmount,
                originalCurrency,
                plaidTx.transactionId(),
                plaidTx.plaidAccountId(),
                plaidTx.plaidItemId(),
                transfer,
                plaidTx.plaidPfcDetailed(),
                plaidTx.pending(),
                plaidTx.pendingTransactionId(),
                plaidTx.postedDate(),
                user.getId(),
                budget != null ? budget.getId() : null);

        if (inserted == 0) {
            // The row already exists — reconcile it as an update (modified).
            transactionRepository
                    .findByPlaidTransactionIdAndUser_Id(plaidTx.transactionId(), user.getId())
                    .ifPresent(tx -> applyUpdate(tx, user, plaidTx));
            return;
        }

        if (!transfer && type == TransactionType.EXPENSE) {
            // Atomic database-side increment — safe against concurrent writers
            // (manual transaction creation or another sync page may touch the
            // same budget at the same time).
            budgetRepository.incrementSpent(budget.getId(), absoluteAmount);
        }
    }

    private String displayName(PlaidTransaction plaidTx, String formattedCategory) {
        return StringUtils.hasText(plaidTx.name()) ? plaidTx.name().trim() : formattedCategory;
    }

    /** Deletes one transaction and restores its budget spent contribution. */
    private void removeTransaction(Transaction tx) {
        if (tx.getType() == TransactionType.EXPENSE && tx.getBudget() != null) {
            // Atomic, zero-floored decrement — safe against concurrent writers.
            budgetRepository.decrementSpentClamped(tx.getBudget().getId(), tx.getAmount());
        }
        transactionRepository.delete(tx);
    }

    /**
     * Resolves the month-scoped budget for a transaction's category.
     *
     * <p>
     * Package-private so concurrency regression tests in this package can
     * drive the race entry point directly.
     * </p>
     */
    Budget resolveOrCreateBudget(User user, String category, Instant txDate) {
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

        // Race-safe creation. Two syncs for DIFFERENT Plaid items of the same
        // user can both pass the check-then-insert lookup above concurrently
        // (the per-item sync lock does not serialize different items). Instead
        // of saveAndFlush — whose unique-constraint failure would abort the
        // surrounding @Transactional unit and surface as a 500 — the insert is
        // a native INSERT ... ON CONFLICT (user_id, category, date) DO NOTHING
        // against the uq_budgets_user_category_month constraint. The losing
        // writer's statement is a silent no-op (NOT an exception), so the
        // enclosing transaction is never invalidated; the re-query below then
        // retrieves the budget the winning writer created and both callers
        // converge on the single persisted row.
        jdbcTemplate.update("""
                INSERT INTO budgets (
                    id, date, category, budget_limit, spent,
                    is_auto_created, user_id, created_at, updated_at
                ) VALUES (?, ?, ?, 0, 0, TRUE, ?, NOW(), NOW())
                ON CONFLICT (user_id, LOWER(TRIM(category)), date) DO NOTHING
                """,
                UUID.randomUUID().toString(),
                Timestamp.from(monthStart),
                category,
                user.getId());

        Optional<Budget> resolved = budgetRepository
                .findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        user.getId(), category, monthStart, nextMonthStart);
        if (resolved.isPresent()) {
            return resolved.get();
        }

        // Defensive fallback for a database that predates the unique-constraint
        // migration and had no row to re-query. Same behavior as before.
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

    /**
     * Mirrors the spending reconciliation in
     * {@code TransactionService.updateTransaction}.
     */
    private void reconcileBudgetOnUpdate(
            Budget oldBudget,
            double oldAmount,
            TransactionType oldType,
            Budget newBudget,
            double newAmount,
            TransactionType newType) {
        boolean sameBudget = oldBudget != null && newBudget != null && oldBudget.getId().equals(newBudget.getId());

        if (newType == TransactionType.EXPENSE) {
            if (oldBudget != null && oldType == TransactionType.EXPENSE && !sameBudget) {
                // Atomic, zero-floored decrement.
                budgetRepository.decrementSpentClamped(oldBudget.getId(), oldAmount);
            }
            if (!sameBudget) {
                // Atomic database-side increment.
                budgetRepository.incrementSpent(newBudget.getId(), newAmount);
            } else {
                double diff = newAmount - oldAmount;
                if (diff != 0.0) {
                    // Atomic database-side adjustment of the same budget.
                    if (diff > 0) {
                        budgetRepository.incrementSpent(newBudget.getId(), diff);
                    } else {
                        budgetRepository.decrementSpentClamped(newBudget.getId(), -diff);
                    }
                }
            }
        } else if (oldBudget != null && oldType == TransactionType.EXPENSE) {
            // Atomic, zero-floored decrement.
            budgetRepository.decrementSpentClamped(oldBudget.getId(), oldAmount);
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

    private String aggregationCurrency(User user) {
        return StringUtils.hasText(user.getCurrency())
                ? user.getCurrency().trim().toUpperCase(Locale.ROOT)
                : DEFAULT_BASE_CURRENCY;
    }

    private Instant monthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}
