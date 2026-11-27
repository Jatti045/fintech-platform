package com.fintechapp.fintech_api.categorization.infrastructure;

import com.fintechapp.fintech_api.categorization.application.ApplyHistoricalRule;
import com.fintechapp.fintech_api.categorization.application.UndoHistoricalRule;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.model.CategorizationRule;
import com.fintechapp.fintech_api.model.RuleApplication;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.RuleApplicationRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.service.CategorizationRuleService;
import com.fintechapp.fintech_api.service.CategorizationRuleService.Change;
import com.fintechapp.fintech_api.service.CategorizationRuleService.Changes;
import com.fintechapp.fintech_api.service.CategorizationRuleService.State;
import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;
import com.fintechapp.fintech_api.service.TransactionClassificationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class HistoricalRuleApplication {
  private final CategorizationRuleService rules;
  private final TransactionClassificationService classification;
  private final TransactionRepository transactions;
  private final RuleApplicationRepository applications;
  private final BudgetRepository budgets;
  private final FinancialCacheInvalidator cache;
  private final ObjectMapper mapper;
  private final ApplyHistoricalRule apply;
  private final UndoHistoricalRule undo;

  public HistoricalRuleApplication(
      CategorizationRuleService rules,
      TransactionClassificationService classification,
      TransactionRepository transactions,
      RuleApplicationRepository applications,
      BudgetRepository budgets,
      FinancialCacheInvalidator cache,
      ObjectMapper mapper) {
    this.rules = rules;
    this.classification = classification;
    this.transactions = transactions;
    this.applications = applications;
    this.budgets = budgets;
    this.cache = cache;
    this.mapper = mapper;
    this.apply = new ApplyHistoricalRule(this::prepare);
    this.undo = new UndoHistoricalRule(this::prepareUndo);
  }

  @Transactional
  public ApplyHistoricalRule.Result apply(AuthenticatedUser auth, String ruleId, String token) {
    try {
      return apply.execute(rules.userId(auth), ruleId, token);
    } catch (ApplyHistoricalRule.StalePreview stale) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "History or rules changed. Preview again before applying");
    }
  }

  private ApplyHistoricalRule.PreparedApplication prepare(String ownerId, String ruleId) {
    classification.lock(ownerId);
    var rule = rules.owned(ownerId, ruleId);
    var preview = rules.computePreview(ownerId, rule);
    return new Journal(ownerId, rule, preview);
  }

  private final class Journal implements ApplyHistoricalRule.PreparedApplication {
    private final String ownerId;
    private final CategorizationRule rule;
    private final CategorizationRuleService.Preview preview;
    private final List<Change> changes = new ArrayList<>();

    private Journal(
        String ownerId, CategorizationRule rule, CategorizationRuleService.Preview preview) {
      this.ownerId = ownerId;
      this.rule = rule;
      this.preview = preview;
    }

    @Override
    public ApplyHistoricalRule.Preview preview() {
      return new ApplyHistoricalRule.Preview(
          preview.token(),
          preview.matches().stream()
              .map(match -> new ApplyHistoricalRule.Match(match.id(), match.winnerId()))
              .toList());
    }

    @Override
    public boolean applyTo(String transactionId) {
      var transaction = transactions.findByIdAndUser_Id(transactionId, ownerId).orElseThrow();
      if (transaction.isRulesDisabled()) {
        return false;
      }
      var before = rules.state(transaction);
      classification.snapshot(transaction, rule);
      classification.classify(transaction, false);
      if (before.equals(rules.state(transaction))) {
        return false;
      }
      changes.add(new Change(transaction.getId(), before, rules.fingerprint(transaction)));
      return true;
    }

    @Override
    public String saveJournal() {
      RuleApplication batch = new RuleApplication();
      batch.setId(UUID.randomUUID().toString());
      batch.setUser(rule.getUser());
      batch.setRuleId(rule.getId());
      batch.setCreatedAt(Instant.now());
      batch.setChangesJson(mapper.writeValueAsString(new Changes(changes)));
      applications.save(batch);
      return batch.getId();
    }

    @Override
    public void evictAfterCommit() {
      cache.evictFinancialDataAfterCommit(ownerId);
    }
  }

  @Transactional
  public UndoHistoricalRule.Result undo(AuthenticatedUser auth, String applicationId) {
    return undo.execute(rules.userId(auth), applicationId);
  }

  private UndoHistoricalRule.PreparedUndo prepareUndo(String ownerId, String applicationId) {
    classification.lock(ownerId);
    var batch =
        applications
            .findByIdAndUser_Id(applicationId, ownerId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    return new UndoJournal(ownerId, batch);
  }

  private final class UndoJournal implements UndoHistoricalRule.PreparedUndo {
    private final String ownerId;
    private final RuleApplication batch;

    private UndoJournal(String ownerId, RuleApplication batch) {
      this.ownerId = ownerId;
      this.batch = batch;
    }

    @Override
    public boolean alreadyUndone() {
      return batch.getUndoneAt() != null;
    }

    @Override
    public List<UndoHistoricalRule.Entry> entries() {
      Changes changes = mapper.readValue(batch.getChangesJson(), Changes.class);
      return changes.changes().stream()
          .<UndoHistoricalRule.Entry>map(change -> new UndoEntry(ownerId, change))
          .toList();
    }

    @Override
    public void markUndone() {
      batch.setUndoneAt(Instant.now());
    }

    @Override
    public void evictAfterCommit() {
      cache.evictFinancialDataAfterCommit(ownerId);
    }
  }

  private final class UndoEntry implements UndoHistoricalRule.Entry {
    private final String ownerId;
    private final Change change;

    private UndoEntry(String ownerId, Change change) {
      this.ownerId = ownerId;
      this.change = change;
    }

    @Override
    public void validate() {
      var tx =
          transactions
              .findByIdAndUser_Id(change.transactionId(), ownerId)
              .orElseThrow(() ->
                  new ResponseStatusException(
                      HttpStatus.CONFLICT, "A transaction was removed; undo is unavailable"));
      if (change.before().budgetId() != null
          && budgets
              .findByIdAndUser_Id(change.before().budgetId(), ownerId)
              .filter(b -> Objects.equals(b.getCategory(), change.before().budgetCategory()))
              .isEmpty()) {
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "The original budget changed; undo is unavailable");
      }
      if (!rules.fingerprint(tx).equals(change.afterFingerprint())) {
        throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "A transaction changed since application; undo would replace newer decisions");
      }
    }

    @Override
    public void restore() {
      var tx = transactions.findByIdAndUser_Id(change.transactionId(), ownerId).orElseThrow();
      restoreState(tx, change.before());
      classification.classify(tx, false, false);
    }
  }

  private static void restoreState(Transaction t, State s) {
    t.setName(s.name());
    t.setCategory(s.category());
    t.setLegacyClassification(s.legacy());
    t.setLegacyBudgetCategory(s.legacyBudget());
    t.setAppliedRuleId(s.ruleId());
    t.setAppliedRuleVersion(s.ruleVersion());
    t.setRuleTitle(s.ruleTitle());
    t.setRuleDisplayName(s.ruleName());
    t.setRuleCategory(s.ruleCategory());
    t.setRuleBudgetCategory(s.ruleBudget());
    t.setNameOverride(s.nameOverride());
    t.setCategoryOverride(s.categoryOverride());
    t.setBudgetOverrideId(s.budgetOverrideId());
    t.setBudgetOverrideCategory(s.budgetOverrideCategory());
    t.setRulesDisabled(s.rulesDisabled());
  }
}
