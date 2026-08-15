package com.fintechapp.fintech_api.service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
 * Maps raw Plaid transaction payloads onto the app's transaction/budget model
 * and applies them idempotently.
 *
 * <p>Each inbound transaction is keyed by {@code transaction_id}. If a local
 * transaction already exists for that id the payload is treated as an
 * "updated" record; otherwise a new transaction is created. Removed records
 * delete the matching local transaction and restore budget spent aggregates.</p>
 *
 * <p>Two additional reconciliation paths keep the store idempotent across
 * Plaid's identifier behavior:
 * <ul>
 *   <li><b>Pending → posted:</b> Plaid may issue a posted transaction a new
 *       {@code transaction_id} and link it to the pending transaction it
 *       replaced via {@code pending_transaction_id}. When the exact id lookup
 *       misses, the pending link is used to update the existing row in place
 *       (a single local record) and adopt the posted id.</li>
 *   <li><b>Reconnect:</b> Plaid scopes {@code transaction_id} to a single
 *       Item, so after a disconnect + reconnect the same underlying bank
 *       transactions are re-served under new ids. When the exact id and
 *       pending links both miss, a (calendar day + amount + type + name +
 *       currency) fingerprint against a row synced by a <em>different</em>
 *       Plaid Item is used to locate candidates — but a fingerprint alone is
 *       <b>never</b> enough to merge. Same-day candidates are only matched on
 *       an <b>exact</b> Plaid transaction timestamp (time-of-day) that is
 *       unique among the candidates, matched one-to-one per sync batch; when
 *       the timestamp evidence is ambiguous or missing the transaction is
 *       inserted. This keeps two legitimate same-day purchases (e.g. two
 *       identical Starbucks orders) from collapsing into one row on reconnect.</li>
 * </ul>
 * </p>
 *
 * <p>The database unique index on {@code plaid_transaction_id} is the final
 * guard: the insert path uses {@code INSERT ... ON CONFLICT DO NOTHING}, so
 * concurrent duplicate syncs can never produce a duplicate row or a rolled
 * back page.</p>
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
            String pendingTransactionId,
            boolean pending,
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
     * <p>Duplicate protection, in order:
     * <ol>
     *   <li>same {@code plaid_transaction_id} for the user → update in place;</li>
     *   <li>a posted transaction whose {@code pending_transaction_id} matches an
     *       existing row → update that row (pending → posted reconciliation);</li>
     *   <li>reconnect fallback: same (calendar day, amount, type, name, currency)
     *       as a row synced by a <em>different</em> Plaid Item → update it, but
     *       only when the match is unambiguous (a single candidate, or a unique
     *       timestamp match within the tolerance window);</li>
     *   <li>otherwise insert, guarded by the database unique index on
     *       {@code plaid_transaction_id} via {@code INSERT ... ON CONFLICT DO NOTHING}.</li>
     * </ol></p>
     */
    @Transactional
    public void upsertTransaction(User user, PlaidTransaction plaidTx, String plaidItemId) {
        upsertTransaction(user, plaidTx, plaidItemId, new HashSet<>());
    }

    /**
     * Applies a whole {@code /transactions/sync} {@code added} batch
     * idempotently. Pending transactions are reconciled first so posted
     * transactions can reference them in the same batch. Reconnect fingerprint
     * matching is <b>one-to-one</b> within the batch: an existing transaction
     * can only be the merge target of a single incoming transaction, which
     * prevents two legitimate same-day purchases from collapsing into one.
     */
    @Transactional
    public void upsertAddedBatch(User user, List<PlaidTransaction> added, String plaidItemId) {
        if (added == null || added.isEmpty()) {
            return;
        }
        List<PlaidTransaction> pendings = added.stream().filter(PlaidTransaction::pending).toList();
        List<PlaidTransaction> nonPendings = added.stream().filter(pt -> !pt.pending()).toList();
        Set<String> matchedExistingIds = new HashSet<>();
        for (PlaidTransaction plaidTx : pendings) {
            upsertTransaction(user, plaidTx, plaidItemId, matchedExistingIds);
        }
        for (PlaidTransaction plaidTx : nonPendings) {
            upsertTransaction(user, plaidTx, plaidItemId, matchedExistingIds);
        }
    }

    private void upsertTransaction(
            User user, PlaidTransaction plaidTx, String plaidItemId, Set<String> matchedExistingIds) {
        if (plaidTx == null || !StringUtils.hasText(plaidTx.transactionId())) {
            return;
        }

        Optional<Transaction> existing =
                transactionRepository.findByPlaidTransactionIdAndUser_Id(plaidTx.transactionId(), user.getId());

        if (existing.isEmpty() && StringUtils.hasText(plaidTx.pendingTransactionId())) {
            logger.info("Reconciling posted transaction {} with pending transaction {}",
                    plaidTx.transactionId(), plaidTx.pendingTransactionId());
            existing = transactionRepository
                    .findByPlaidTransactionIdAndUser_Id(plaidTx.pendingTransactionId(), user.getId());
        }

        if (existing.isEmpty()) {
            existing = findReconnectMatch(user, plaidTx, plaidItemId, matchedExistingIds);
        }

        if (existing.isPresent()) {
            matchedExistingIds.add(existing.get().getId());
            applyUpdate(existing.get(), user, plaidTx, plaidItemId);
        } else {
            insert(user, plaidTx, plaidItemId);
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
     * Reconnect fallback. Plaid scopes {@code transaction_id} to a single
     * Item: after a disconnect + reconnect the same underlying transactions
     * come back with brand-new ids. When the exact-id and pending links miss,
     * candidates are located by a (calendar day + amount + type + name +
     * currency) fingerprint restricted to rows synced by a <em>different</em>
     * Plaid Item.
     *
     * <p>A fingerprint alone is never sufficient to merge. Same-day candidates
     * are disambiguated by the Plaid transaction timestamp (time-of-day):
     * <ul>
     *   <li>a single candidate is unambiguous and is matched;</li>
     *   <li>otherwise the incoming transaction is matched only when exactly one
     *       candidate's stored timestamp equals its own — proximity within any
     *       window is never treated as evidence;</li>
     *   <li>when the evidence is ambiguous (no timestamp, several candidates at
     *       the same instant, or no exact timestamp match), the transaction is
     *       inserted instead of risking a false merge.</li>
     * </ul>
     * Rows from the same Item are never fingerprinted, so two genuinely
     * identical transactions from the same Item remain separate.</p>
     */
    private Optional<Transaction> findReconnectMatch(
            User user, PlaidTransaction plaidTx, String plaidItemId, Set<String> matchedExistingIds) {
        if (!StringUtils.hasText(plaidItemId)) {
            return Optional.empty();
        }
        String name = displayName(plaidTx, categoryFormatter.toReadableCategory(plaidTx.category()));
        if (!StringUtils.hasText(name)) {
            return Optional.empty();
        }
        Instant date = plaidTx.date();
        if (date == null || date.equals(Instant.EPOCH)) {
            return Optional.empty();
        }
        double absoluteAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String currency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        if (!StringUtils.hasText(currency)) {
            return Optional.empty();
        }

        // Day-level fingerprint: Plaid timestamps can differ slightly across a
        // reconnect (representation/precision), so group by calendar day and
        // disambiguate same-day candidates by the stored timestamp below.
        LocalDate day = LocalDate.ofInstant(date, ZoneOffset.UTC);
        Instant dayStart = day.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant dayEnd = dayStart.plus(1, ChronoUnit.DAYS);

        List<Transaction> candidates = transactionRepository
                .findByUser_IdAndDateGreaterThanEqualAndDateLessThanAndAmountAndTypeAndName(
                        user.getId(), dayStart, dayEnd, absoluteAmount, type, name)
                .stream()
                .filter(t -> StringUtils.hasText(t.getPlaidTransactionId()))
                .filter(t -> StringUtils.hasText(t.getPlaidItemId()))
                .filter(t -> !t.getPlaidItemId().equals(plaidItemId))
                .filter(t -> !matchedExistingIds.contains(t.getId()))
                .filter(t -> Objects.equals(t.getBaseCurrency(), currency))
                .toList();

        if (candidates.isEmpty()) {
            return Optional.empty();
        }
        if (candidates.size() == 1) {
            // Exactly one existing transaction matches — unambiguous.
            return Optional.of(candidates.get(0));
        }
        return matchByTimestamp(date, candidates);
    }

    /**
     * Disambiguates multiple same-day fingerprint candidates using the Plaid
     * transaction timestamp (time-of-day). A candidate is only matched when the
     * evidence is unambiguous: the incoming transaction's timestamp must equal
     * the candidate's stored timestamp <em>exactly</em>, and there must be
     * exactly one such candidate.
     *
     * <p>Proximity is deliberately NOT evidence: two legitimate purchases 20
     * minutes apart must never be merged just because one happens to be
     * "closest" to the incoming timestamp. When timestamps do not match exactly
     * (or several candidates share the same instant), the match is ambiguous
     * and empty is returned so the transaction is inserted instead of risking a
     * false merge.</p>
     */
    private Optional<Transaction> matchByTimestamp(Instant incomingTimestamp, List<Transaction> candidates) {
        if (incomingTimestamp == null || !hasTimeOfDay(incomingTimestamp)) {
            return Optional.empty(); // no usable timestamp evidence on the incoming side
        }
        List<Transaction> exact = candidates.stream()
                .filter(t -> incomingTimestamp.equals(t.getDate()))
                .toList();
        return exact.size() == 1 ? Optional.of(exact.get(0)) : Optional.empty();
    }

    /** True when the instant carries a time-of-day (i.e. is not exactly UTC midnight). */
    private static boolean hasTimeOfDay(Instant instant) {
        if (instant == null) {
            return false;
        }
        LocalDate day = LocalDate.ofInstant(instant, ZoneOffset.UTC);
        return !instant.equals(day.atStartOfDay().toInstant(ZoneOffset.UTC));
    }

    /** Updates an existing local transaction with the incoming Plaid payload. */
    private void applyUpdate(Transaction tx, User user, PlaidTransaction plaidTx, String plaidItemId) {
        discardOtherOwnerOf(tx, user, plaidTx.transactionId());

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
        tx.setPlaidItemId(plaidItemId);
        tx.setPlaidPendingTransactionId(plaidTx.pendingTransactionId());
        tx.setBudget(budget);
        transactionRepository.save(tx);

        reconcileBudgetOnUpdate(oldBudget, oldAmount, oldType, budget, absoluteAmount, type);
    }

    /**
     * When {@code tx} is adopting a new transaction id (pending → posted or a
     * reconnect), another row may already own that id (e.g. it was inserted
     * before the reconciliation logic existed). Remove that duplicate row so
     * the id can be adopted without violating the unique index. The duplicate
     * is deleted with a native statement so it is gone before the JPA update
     * is flushed (Hibernate flushes updates before deletes).
     */
    private void discardOtherOwnerOf(Transaction tx, User user, String newPlaidTransactionId) {
        if (!StringUtils.hasText(newPlaidTransactionId)
                || Objects.equals(tx.getPlaidTransactionId(), newPlaidTransactionId)) {
            return;
        }
        transactionRepository.findByPlaidTransactionIdAndUser_Id(newPlaidTransactionId, user.getId())
                .filter(other -> !other.getId().equals(tx.getId()))
                .ifPresent(other -> {
                    if (other.getType() == TransactionType.EXPENSE && other.getBudget() != null) {
                        Budget budget = other.getBudget();
                        budget.setSpent(Math.max(0, budget.getSpent() - other.getAmount()));
                        budgetRepository.save(budget);
                    }
                    jdbcTemplate.update("DELETE FROM transactions WHERE id = ?", other.getId());
                });
    }

    /**
     * Inserts a new transaction via native {@code INSERT ... ON CONFLICT DO
     * NOTHING}: the database unique index on {@code plaid_transaction_id} is
     * the final guard against concurrent duplicate syncs. A conflict means
     * another sync already stored the transaction — its row is loaded and
     * reconciled as an update instead.
     */
    private void insert(User user, PlaidTransaction plaidTx, String plaidItemId) {
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
                    plaid_transaction_id, plaid_item_id, plaid_pending_transaction_id,
                    description, user_id, budget_id, goal_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NOW(), NOW())
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
                plaidItemId,
                plaidTx.pendingTransactionId(),
                user.getId(),
                budget.getId());

        if (inserted == 0) {
            // A concurrent sync won the race — reconcile its row.
            transactionRepository
                    .findByPlaidTransactionIdAndUser_Id(plaidTx.transactionId(), user.getId())
                    .ifPresent(tx -> applyUpdate(tx, user, plaidTx, plaidItemId));
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