package com.fintechapp.fintech_api.service;

import java.text.Normalizer;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;

@Service
public class TransactionClassificationService {
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entities;
    private final TransactionRepository transactions;
    private final BudgetRepository budgets;
    private final CategorizationRuleRepository rules;
    private final UserRepository users;
    private final FinancialCacheInvalidator cache;
    public TransactionClassificationService(TransactionRepository transactions, BudgetRepository budgets,
            CategorizationRuleRepository rules, UserRepository users, FinancialCacheInvalidator cache) {
        this.transactions = transactions; this.budgets = budgets; this.rules = rules; this.users = users; this.cache = cache;
    }
    public void lock(String userId) {
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
    public static String normalize(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }
    public boolean matches(CategorizationRule rule, Transaction tx) {
        if (!rule.isEnabled()) return false;
        if (rule.getDirection() != null && !rule.getDirection().equals(tx.getType().name())) return false;
        if (rule.getAccountId() != null && !rule.getAccountId().equals(tx.getPlaidAccountId())) return false;
        if (rule.getProviderCategoryCondition() != null && !normalize(rule.getProviderCategoryCondition()).equals(normalize(tx.getProviderCategory()))) return false;
        String value = "DESCRIPTION".equals(rule.getField()) ? tx.getDescription() : tx.getProviderName() != null ? tx.getProviderName() : tx.getName();
        return switch (rule.getMatchMode()) {
            case "EXACT" -> Objects.equals(value, rule.getMatchText());
            case "NORMALIZED_EXACT" -> normalize(value).equals(normalize(rule.getMatchText()));
            case "CONTAINS" -> normalize(value).contains(normalize(rule.getMatchText()));
            default -> false;
        };
    }
    public List<CategorizationRule> matching(Transaction tx) {
        return matching(tx, rules.findByUser_IdOrderByPriorityAscCreatedAtAscIdAsc(tx.getUser().getId()));
    }
    public List<CategorizationRule> matching(Transaction tx, List<CategorizationRule> candidates) {
        return candidates.stream().filter(r -> matches(r,tx)).toList();
    }
    public void snapshot(Transaction tx, CategorizationRule rule) {
        tx.setAppliedRuleId(rule.getId()); tx.setAppliedRuleVersion(rule.getRevision()); tx.setRuleTitle(rule.getTitle());
        tx.setRuleDisplayName(rule.getDisplayName()); tx.setRuleCategory(rule.getCategory()); tx.setRuleBudgetCategory(rule.getBudgetCategory());
    }
    @Transactional
    public void classify(Transaction tx) { classify(tx, true); }

    @Transactional
    public void classify(Transaction tx, boolean invalidate) { classify(tx,invalidate,true); }

    @Transactional
    public void classify(Transaction tx, boolean invalidate, boolean selectRules) {
        lock(tx.getUser().getId());
        if (selectRules && tx.getAppliedRuleId() == null && !tx.isLegacyClassification() && !tx.isRulesDisabled()) {
            matching(tx).stream().filter(r -> tx.getCreatedAt() == null || !tx.getCreatedAt().isBefore(r.getEffectiveAt())).findFirst().ifPresent(r -> snapshot(tx, r));
        }
        String oldBudget = tx.getBudget() == null ? null : tx.getBudget().getId();
        Decision decision = decision(tx, tx.getRuleDisplayName(), tx.getRuleCategory(), tx.getRuleBudgetCategory());
        tx.setName(decision.name()); tx.setCategory(decision.category());
        Budget target = null;
        if (tx.getType() == TransactionType.EXPENSE && !tx.isTransfer()) {
            String budgetCategory = decision.budgetCategory();
            if (tx.getBudgetOverrideId() != null) {
                Budget anchor = budgets.findByIdAndUser_Id(tx.getBudgetOverrideId(), tx.getUser().getId()).orElse(null);
                if (anchor != null && sameMonth(anchor.getDate(), tx.getDate())) target = anchor;
            }
            if (target == null) target = resolveBudget(tx.getUser(), budgetCategory, tx.getDate());
        }
        tx.setBudget(target);
        transactions.saveAndFlush(tx);
        String targetId = target == null ? null : target.getId();
        if (!Objects.equals(oldBudget, targetId)) {
            if (oldBudget != null) budgets.recalculateSpent(oldBudget);
            if (targetId != null) budgets.recalculateSpent(targetId);
        }
        if (target != null) entities.refresh(target);
        if (invalidate) cache.evictFinancialDataAfterCommit(tx.getUser().getId());
    }
    public record Decision(String name, String category, String budgetCategory) {}
    public Decision decision(Transaction tx, String ruleName, String ruleCategory, String ruleBudget) {
        String name = tx.getNameOverride() != null ? tx.getNameOverride() : ruleName != null ? ruleName
                : tx.isLegacyClassification() ? tx.getLegacyName() != null ? tx.getLegacyName() : tx.getName()
                : tx.getProviderName() != null ? tx.getProviderName() : tx.getName();
        String category = tx.getCategoryOverride() != null ? tx.getCategoryOverride() : ruleCategory != null ? ruleCategory
                : tx.isLegacyClassification() ? tx.getLegacyCategory() != null ? tx.getLegacyCategory() : tx.getCategory()
                : tx.getProviderCategory() != null ? tx.getProviderCategory() : "Uncategorized";
        String budgetCategory = tx.getBudgetOverrideCategory();
        if (tx.getBudgetOverrideId() != null) {
            Budget anchor = budgets.findByIdAndUser_Id(tx.getBudgetOverrideId(), tx.getUser().getId()).orElse(null);
            if (anchor != null) budgetCategory = anchor.getCategory();
        }
        if (budgetCategory == null) budgetCategory = ruleBudget;
        if (budgetCategory == null && tx.isLegacyClassification()) budgetCategory = tx.getLegacyBudgetCategory();
        if (budgetCategory == null) budgetCategory = category;
        if (tx.getType() != TransactionType.EXPENSE || tx.isTransfer()) budgetCategory = null;
        return new Decision(name == null || name.isBlank() ? "Unknown transaction" : name, category, budgetCategory);
    }
    private static boolean sameMonth(Instant a, Instant b) { return YearMonth.from(a.atZone(ZoneOffset.UTC)).equals(YearMonth.from(b.atZone(ZoneOffset.UTC))); }
    private Budget resolveBudget(User user, String category, Instant date) {
        YearMonth month = YearMonth.from(date.atZone(ZoneOffset.UTC));
        Instant from = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC), to = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        return budgets.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(user.getId(), category, from, to).orElseGet(() -> {
            Budget b = new Budget(); b.setUser(user); b.setCategory(category); b.setDate(from); b.setLimit(0); b.setAutoCreated(true); return budgets.saveAndFlush(b);
        });
    }
    public static void inherit(Transaction pending, Transaction posted) {
        posted.setRulesDisabled(posted.isRulesDisabled() || pending.isRulesDisabled());
        if (posted.getNameOverride() == null) posted.setNameOverride(pending.getNameOverride());
        if (posted.getCategoryOverride() == null) posted.setCategoryOverride(pending.getCategoryOverride());
        if (posted.getBudgetOverrideCategory() == null) { posted.setBudgetOverrideCategory(pending.getBudgetOverrideCategory()); posted.setBudgetOverrideId(pending.getBudgetOverrideId()); }
        if (posted.getAppliedRuleId() == null) {
            posted.setAppliedRuleId(pending.getAppliedRuleId()); posted.setAppliedRuleVersion(pending.getAppliedRuleVersion()); posted.setRuleTitle(pending.getRuleTitle());
            posted.setRuleDisplayName(pending.getRuleDisplayName()); posted.setRuleCategory(pending.getRuleCategory()); posted.setRuleBudgetCategory(pending.getRuleBudgetCategory());
        }
        if (pending.isLegacyClassification() && posted.getAppliedRuleId() == null) {
            posted.setLegacyClassification(true); posted.setLegacyName(pending.getLegacyName()); posted.setLegacyCategory(pending.getLegacyCategory()); posted.setLegacyBudgetCategory(pending.getLegacyBudgetCategory()); posted.setName(pending.getName()); posted.setCategory(pending.getCategory());
            if (posted.getLegacyBudgetCategory() == null && pending.getBudget() != null) posted.setLegacyBudgetCategory(pending.getBudget().getCategory());
        }
    }
}
