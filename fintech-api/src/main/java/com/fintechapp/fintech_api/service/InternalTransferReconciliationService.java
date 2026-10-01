package com.fintechapp.fintech_api.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

/**
 * The single owner of persisted transfer decisions. Recomputes mutually unique
 * candidate pairs; the two transfer legs are never merged, deleted, or hidden.
 * Explicitly superseded pending versions are retired before matching.
 */
@Service
public class InternalTransferReconciliationService {
    private final TransactionRepository transactions;
    private final BudgetRepository budgets;
    private final UserRepository users;
    private final PlaidTransactionIngestService ingest;
    private final FinancialCacheInvalidator cacheInvalidator;

    public InternalTransferReconciliationService(TransactionRepository transactions,
            BudgetRepository budgets, UserRepository users, PlaidTransactionIngestService ingest,
            FinancialCacheInvalidator cacheInvalidator) {
        this.transactions = transactions;
        this.budgets = budgets;
        this.users = users;
        this.ingest = ingest;
        this.cacheInvalidator = cacheInvalidator;
    }

    /** Caller acquires this BEFORE page/manual writes; different items share the same lock. */
    @Transactional
    public void lockUser(String userId) {
        users.findByIdForUpdate(userId).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "User not authenticated"));
    }

    /** Reevaluate even a lone surviving leg, after every page mutation has been flushed. */
    @Transactional
    public void reconcile(String userId) {
        lockUser(userId);
        transactions.flush();
        reconcile(userId, false);
    }

    /**
     * Explicit, opt-in history maintenance. No Plaid fetch or automatic startup backfill.
     * Only metadata-complete, unambiguous pairs are newly classified; other historical
     * decisions remain unchanged. Affected budget totals are rebuilt from stored expenses.
     */
    @Transactional
    public void reconcileHistory(String userId) {
        lockUser(userId);
        transactions.flush();
        reconcile(userId, true);
    }

    private void reconcile(String userId, boolean historical) {
        List<Transaction> rows = new ArrayList<>(transactions.findTransferCandidates(userId));
        Set<String> retiredPendingIds = new HashSet<>();
        if (!historical) {
            Map<String, Transaction> pendingByPlaidId = new HashMap<>();
            for (Transaction tx : rows) {
                if (ownedBy(tx, userId) && Boolean.TRUE.equals(tx.getPlaidPending())
                        && StringUtils.hasText(tx.getPlaidTransactionId())) {
                    pendingByPlaidId.put(tx.getPlaidTransactionId(), tx);
                }
            }
            for (Transaction posted : rows) {
                Transaction pending = pendingByPlaidId.get(posted.getPlaidPendingTransactionId());
                if (ownedBy(posted, userId) && Boolean.FALSE.equals(posted.getPlaidPending())
                        && StringUtils.hasText(posted.getPlaidTransactionId())
                        && pending != null && !posted.getId().equals(pending.getId())
                        && StringUtils.hasText(posted.getPlaidItemId())
                        && posted.getPlaidItemId().equals(pending.getPlaidItemId())
                        && StringUtils.hasText(posted.getPlaidAccountId())
                        && posted.getPlaidAccountId().equals(pending.getPlaidAccountId())) {
                    retiredPendingIds.add(pending.getPlaidTransactionId());
                }
            }
            if (!retiredPendingIds.isEmpty()) {
                // These are obsolete versions explicitly identified by Plaid,
                // not the two independently visible internal-transfer legs.
                ingest.removeByPlaidIds(new ArrayList<>(retiredPendingIds), userId);
                transactions.flush();
                rows.removeIf(tx -> retiredPendingIds.contains(tx.getPlaidTransactionId()));
            }
        }
        Set<String> replacedPendingIds = new HashSet<>();
        for (Transaction tx : rows) {
            if (ownedBy(tx, userId) && StringUtils.hasText(tx.getPlaidPendingTransactionId())) {
                replacedPendingIds.add(tx.getPlaidPendingTransactionId());
            }
        }
        Map<String, List<Transaction>> buckets = new HashMap<>();
        for (Transaction tx : rows) {
            if (!ownedBy(tx, userId) || !hasMatchingMetadata(tx) || !PlaidTransferDetector.isCandidate(tx)
                    || Boolean.TRUE.equals(tx.getPlaidPending())
                    || replacedPendingIds.contains(tx.getPlaidTransactionId())) {
                continue;
            }
            String key = tx.getOriginalCurrency().trim().toUpperCase(Locale.ROOT) + "|"
                    + BigDecimal.valueOf(tx.getOriginalAmount()).stripTrailingZeros().toPlainString();
            buckets.computeIfAbsent(key, ignored -> new ArrayList<>()).add(tx);
        }

        Set<String> matched = new HashSet<>();
        for (List<Transaction> bucket : buckets.values()) {
            Map<String, List<Transaction>> possible = new HashMap<>();
            for (Transaction a : bucket) {
                List<Transaction> neighbors = new ArrayList<>();
                for (Transaction b : bucket) {
                    if (!a.getId().equals(b.getId()) && a.getType() != b.getType()
                            && !a.getPlaidAccountId().equals(b.getPlaidAccountId())
                            && Math.abs(ChronoUnit.DAYS.between(day(a), day(b))) <= 3) {
                        neighbors.add(b);
                    }
                }
                possible.put(a.getId(), neighbors);
            }
            // Both sides must have exactly one possible counterpart. Never break ties
            // by row order or progressively consume a contested leg.
            for (Transaction a : bucket) {
                List<Transaction> neighbors = possible.get(a.getId());
                if (neighbors.size() == 1 && possible.get(neighbors.get(0).getId()).size() == 1) {
                    matched.add(a.getId());
                    matched.add(neighbors.get(0).getId());
                }
            }
        }

        Set<String> affectedBudgets = new HashSet<>();
        Set<String> repairBudgets = new HashSet<>();
        boolean changed = !retiredPendingIds.isEmpty();
        for (Transaction tx : rows) {
            if (!ownedBy(tx, userId)) {
                continue;
            }
            boolean transfer = matched.contains(tx.getId());
            if (historical && !transfer) {
                continue; // incomplete/ambiguous historical rows are not guessed at
            }
            Budget oldBudget = tx.getBudget();
            if (historical && oldBudget != null) {
                affectedBudgets.add(oldBudget.getId());
            }
            if (transfer == tx.isTransfer() && !(transfer && oldBudget != null)) {
                continue;
            }
            if (tx.isTransfer() && oldBudget != null) {
                // Repair legacy manual-edit inconsistencies without guessing whether
                // the flagged row was already included in the cached budget total.
                repairBudgets.add(oldBudget.getId());
            }
            if (transfer) {
                if (!tx.isTransfer() && oldBudget != null && tx.getType() == TransactionType.EXPENSE) {
                    budgets.decrementSpentClamped(oldBudget.getId(), tx.getAmount());
                    affectedBudgets.add(oldBudget.getId());
                }
                tx.setBudget(null);
            } else if (tx.getType() == TransactionType.EXPENSE) {
                Budget budget = ingest.resolveOrCreateBudget(tx.getUser(), tx.getCategory(), tx.getDate());
                tx.setBudget(budget);
                budgets.incrementSpent(budget.getId(), tx.getAmount());
                affectedBudgets.add(budget.getId());
            }
            tx.setTransfer(transfer);
            transactions.save(tx);
            changed = true;
        }
        if (historical) {
            repairBudgets.addAll(affectedBudgets);
        }
        if (!repairBudgets.isEmpty()) {
            transactions.flush();
            for (String budgetId : repairBudgets) {
                budgets.recalculateSpent(budgetId);
            }
        }
        if (changed || !repairBudgets.isEmpty()) {
            cacheInvalidator.evictFinancialDataAfterCommit(userId);
        }
    }

    private static boolean ownedBy(Transaction tx, String userId) {
        return tx.getUser() != null && userId.equals(tx.getUser().getId());
    }

    private static boolean hasMatchingMetadata(Transaction tx) {
        return StringUtils.hasText(tx.getPlaidTransactionId()) && StringUtils.hasText(tx.getPlaidItemId())
                && StringUtils.hasText(tx.getPlaidAccountId()) && StringUtils.hasText(tx.getOriginalCurrency())
                && tx.getOriginalAmount() != null && Double.isFinite(tx.getOriginalAmount())
                && tx.getOriginalAmount() > 0 && tx.getDate() != null
                && !java.time.Instant.EPOCH.equals(tx.getDate());
    }

    private static LocalDate day(Transaction tx) {
        return tx.getPlaidPostedDate() != null ? tx.getPlaidPostedDate()
                : LocalDate.ofInstant(tx.getDate(), ZoneOffset.UTC);
    }
}
