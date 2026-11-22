package com.fintechapp.fintech_api.categorization.infrastructure;

import com.fintechapp.fintech_api.categorization.application.ApplyHistoricalRule;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.model.CategorizationRule;
import com.fintechapp.fintech_api.model.RuleApplication;
import com.fintechapp.fintech_api.repository.RuleApplicationRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.service.CategorizationRuleService;
import com.fintechapp.fintech_api.service.CategorizationRuleService.Change;
import com.fintechapp.fintech_api.service.CategorizationRuleService.Changes;
import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;
import com.fintechapp.fintech_api.service.TransactionClassificationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
  private final FinancialCacheInvalidator cache;
  private final ObjectMapper mapper;
  private final ApplyHistoricalRule apply;

  public HistoricalRuleApplication(
      CategorizationRuleService rules,
      TransactionClassificationService classification,
      TransactionRepository transactions,
      RuleApplicationRepository applications,
      FinancialCacheInvalidator cache,
      ObjectMapper mapper) {
    this.rules = rules;
    this.classification = classification;
    this.transactions = transactions;
    this.applications = applications;
    this.cache = cache;
    this.mapper = mapper;
    this.apply = new ApplyHistoricalRule(this::prepare);
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
}
