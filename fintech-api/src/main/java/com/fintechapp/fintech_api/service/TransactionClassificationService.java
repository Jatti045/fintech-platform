package com.fintechapp.fintech_api.service;

import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionClassificationService {
  @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entities;
  private final TransactionRepository transactions;
  private final BudgetRepository budgets;
  private final CategorizationRuleRepository rules;
  private final UserRepository users;
  private final FinancialCacheInvalidator cache;

  public TransactionClassificationService(
      TransactionRepository transactions,
      BudgetRepository budgets,
      CategorizationRuleRepository rules,
      UserRepository users,
      FinancialCacheInvalidator cache) {
    this.transactions = transactions;
    this.budgets = budgets;
    this.rules = rules;
    this.users = users;
    this.cache = cache;
  }

  public void lock(String userId) {
    users
        .findByIdForUpdate(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
  }

  public static String normalize(String text) {
    return ClassificationPolicy.normalize(text);
  }

  public boolean matches(CategorizationRule rule, Transaction tx) {
    return ClassificationPolicy.matches(
        new ClassificationPolicy.RuleCondition(
            rule.isEnabled(),
            rule.getDirection(),
            rule.getAccountId(),
            rule.getProviderCategoryCondition(),
            rule.getField(),
            rule.getMatchMode(),
            rule.getMatchText()),
        tx == null
            ? null
            : new ClassificationPolicy.MatchFacts(
                tx.getType() == null ? null : tx.getType().name(),
                tx.getPlaidAccountId(),
                tx.getProviderCategory(),
                tx.getDescription(),
                tx.getProviderName(),
                tx.getName()));
  }

  public List<CategorizationRule> matching(Transaction tx) {
    return matching(
        tx, rules.findByUser_IdOrderByPriorityAscCreatedAtAscIdAsc(tx.getUser().getId()));
  }

  public List<CategorizationRule> matching(Transaction tx, List<CategorizationRule> candidates) {
    return candidates.stream().filter(r -> matches(r, tx)).toList();
  }

  public void snapshot(Transaction tx, CategorizationRule rule) {
    tx.setAppliedRuleId(rule.getId());
    tx.setAppliedRuleVersion(rule.getRevision());
    tx.setRuleTitle(rule.getTitle());
    tx.setRuleDisplayName(rule.getDisplayName());
    tx.setRuleCategory(rule.getCategory());
    tx.setRuleBudgetCategory(rule.getBudgetCategory());
  }

  @Transactional
  public void classify(Transaction tx) {
    classify(tx, true);
  }

  @Transactional
  public void classify(Transaction tx, boolean invalidate) {
    classify(tx, invalidate, true);
  }

  @Transactional
  public void classify(Transaction tx, boolean invalidate, boolean selectRules) {
    lock(tx.getUser().getId());
    if (ClassificationPolicy.permitsLiveSelection(
        selectRules, tx.getAppliedRuleId(), tx.isLegacyClassification(), tx.isRulesDisabled())) {
      var matches = matching(tx);
      ClassificationPolicy.firstEffectiveMatch(
              tx.getCreatedAt(), matches.stream().map(CategorizationRule::getEffectiveAt).toList())
          .ifPresent(index -> snapshot(tx, matches.get(index)));
    }
    String oldBudget = tx.getBudget() == null ? null : tx.getBudget().getId();
    Decision decision =
        decision(tx, tx.getRuleDisplayName(), tx.getRuleCategory(), tx.getRuleBudgetCategory());
    tx.setName(decision.name());
    tx.setCategory(decision.category());
    Budget target = null;
    if (tx.getType() == TransactionType.EXPENSE && !tx.isTransfer()) {
      String budgetCategory = decision.budgetCategory();
      if (tx.getBudgetOverrideId() != null) {
        Budget anchor =
            budgets.findByIdAndUser_Id(tx.getBudgetOverrideId(), tx.getUser().getId()).orElse(null);
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

  public Decision decision(
      Transaction tx, String ruleName, String ruleCategory, String ruleBudget) {
    var facts =
        new ClassificationPolicy.DisplayFacts(
            tx.getName(),
            tx.getCategory(),
            tx.getProviderName(),
            tx.getProviderCategory(),
            tx.getNameOverride(),
            tx.getCategoryOverride(),
            tx.getBudgetOverrideCategory(),
            tx.isLegacyClassification(),
            tx.getLegacyName(),
            tx.getLegacyCategory(),
            tx.getLegacyBudgetCategory(),
            tx.getType() == TransactionType.EXPENSE,
            tx.isTransfer());
    ClassificationPolicy.OwnedBudgetAnchor anchor = null;
    if (tx.getBudgetOverrideId() != null) {
      anchor =
          budgets
              .findByIdAndUser_Id(tx.getBudgetOverrideId(), tx.getUser().getId())
              .map(budget -> new ClassificationPolicy.OwnedBudgetAnchor(budget.getCategory()))
              .orElse(null);
    }
    var result =
        ClassificationPolicy.decide(
            facts,
            new ClassificationPolicy.RuleActions(ruleName, ruleCategory, ruleBudget),
            anchor);
    return new Decision(result.name(), result.category(), result.budgetCategory());
  }

  private static boolean sameMonth(Instant a, Instant b) {
    return YearMonth.from(a.atZone(ZoneOffset.UTC))
        .equals(YearMonth.from(b.atZone(ZoneOffset.UTC)));
  }

  private Budget resolveBudget(User user, String category, Instant date) {
    YearMonth month = YearMonth.from(date.atZone(ZoneOffset.UTC));
    Instant from = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC),
        to = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    return budgets
        .findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
            user.getId(), category, from, to)
        .orElseGet(() -> {
          Budget b = new Budget();
          b.setUser(user);
          b.setCategory(category);
          b.setDate(from);
          b.setLimit(0);
          b.setAutoCreated(true);
          return budgets.saveAndFlush(b);
        });
  }

  public static void inherit(Transaction pending, Transaction posted) {
    posted.setRulesDisabled(posted.isRulesDisabled() || pending.isRulesDisabled());
    if (posted.getNameOverride() == null) posted.setNameOverride(pending.getNameOverride());
    if (posted.getCategoryOverride() == null)
      posted.setCategoryOverride(pending.getCategoryOverride());
    if (posted.getBudgetOverrideCategory() == null) {
      posted.setBudgetOverrideCategory(pending.getBudgetOverrideCategory());
      posted.setBudgetOverrideId(pending.getBudgetOverrideId());
    }
    if (posted.getAppliedRuleId() == null) {
      posted.setAppliedRuleId(pending.getAppliedRuleId());
      posted.setAppliedRuleVersion(pending.getAppliedRuleVersion());
      posted.setRuleTitle(pending.getRuleTitle());
      posted.setRuleDisplayName(pending.getRuleDisplayName());
      posted.setRuleCategory(pending.getRuleCategory());
      posted.setRuleBudgetCategory(pending.getRuleBudgetCategory());
    }
    if (pending.isLegacyClassification() && posted.getAppliedRuleId() == null) {
      posted.setLegacyClassification(true);
      posted.setLegacyName(pending.getLegacyName());
      posted.setLegacyCategory(pending.getLegacyCategory());
      posted.setLegacyBudgetCategory(pending.getLegacyBudgetCategory());
      posted.setName(pending.getName());
      posted.setCategory(pending.getCategory());
      if (posted.getLegacyBudgetCategory() == null && pending.getBudget() != null)
        posted.setLegacyBudgetCategory(pending.getBudget().getCategory());
    }
  }
}
