package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

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
 * Maps raw Plaid transaction payloads onto the app's transaction/budget model
 * and applies them idempotently.
 *
 * <p>Each inbound transaction is keyed by {@code transaction_id}. If a local
 * transaction already exists for that id the payload is treated as an
 * "updated" record; otherwise a new transaction is created. Removed records
 * delete the matching local transaction and restore budget spent aggregates.</p>
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

    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final PlaidCategoryFormatter categoryFormatter;

    public PlaidTransactionIngestService(
            TransactionRepository transactionRepository,
            BudgetRepository budgetRepository,
            PlaidCategoryFormatter categoryFormatter) {
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
        this.categoryFormatter = categoryFormatter;
    }

    /**
     * Creates or updates a transaction for {@code plaidTx}, resolving (and
     * auto-creating if necessary) the user's zero-budget category for the
     * transaction's month. Idempotent on the Plaid transaction id.
     */
    @Transactional
    public void upsertTransaction(User user, PlaidTransaction plaidTx) {
        if (plaidTx == null || !StringUtils.hasText(plaidTx.transactionId())) {
            return;
        }

        Optional<Transaction> existing =
                transactionRepository.findByPlaidTransactionIdAndUser_Id(plaidTx.transactionId(), user.getId());

        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        int year = LocalDate.ofInstant(txDate, ZoneOffset.UTC).getYear();
        int monthIndex = LocalDate.ofInstant(txDate, ZoneOffset.UTC).getMonthValue() - 1;
        Instant monthStart = monthStart(year, monthIndex);
        Instant nextMonthStart = nextMonthStart(year, monthIndex);

        Budget budget = resolveOrCreateBudget(user, category, monthStart, nextMonthStart);

        double absoluteAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String baseCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);

        if (existing.isPresent()) {
            Transaction tx = existing.get();
            Budget oldBudget = tx.getBudget();
            double oldAmount = tx.getAmount();
            TransactionType oldType = tx.getType();

            tx.setName(StringUtils.hasText(plaidTx.name()) ? plaidTx.name().trim() : category);
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
            return;
        }

        Transaction tx = new Transaction();
        tx.setUser(user);
        tx.setName(StringUtils.hasText(plaidTx.name()) ? plaidTx.name().trim() : category);
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

        if (type == TransactionType.EXPENSE) {
            budget.setSpent(budget.getSpent() + absoluteAmount);
            budgetRepository.save(budget);
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
            if (tx.getType() == TransactionType.EXPENSE && tx.getBudget() != null) {
                Budget budget = tx.getBudget();
                budget.setSpent(Math.max(0, budget.getSpent() - tx.getAmount()));
                budgetRepository.save(budget);
            }
            transactionRepository.delete(tx);
        }
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
        return budgetRepository.save(created);
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