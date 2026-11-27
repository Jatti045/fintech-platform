package com.fintechapp.fintech_api.service;

import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class CategorizationRuleService {
  private final CategorizationRuleRepository rules;
  private final RuleApplicationRepository applications;
  private final TransactionRepository transactions;
  private final TransactionClassificationService classification;
  private final ObjectMapper mapper;
  private final UserRepository users;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;

  public CategorizationRuleService(
      CategorizationRuleRepository rules,
      RuleApplicationRepository applications,
      TransactionRepository transactions,
      TransactionClassificationService classification,
      ObjectMapper mapper,
      UserRepository users,
      org.springframework.jdbc.core.JdbcTemplate jdbc) {
    this.rules = rules;
    this.applications = applications;
    this.transactions = transactions;
    this.classification = classification;
    this.mapper = mapper;
    this.users = users;
    this.jdbc = jdbc;
  }

  public record RuleView(
      String id,
      String title,
      String field,
      String matchMode,
      String matchText,
      String direction,
      String accountId,
      String providerCategoryCondition,
      String category,
      String budgetCategory,
      String displayName,
      int priority,
      boolean enabled,
      long revision,
      Instant createdAt,
      Instant effectiveAt) {}

  public record Match(
      String id,
      String name,
      String category,
      String budgetCategory,
      String proposedName,
      String proposedCategory,
      String proposedBudgetCategory,
      boolean protectedOverride,
      List<String> matchingRules,
      String winnerId) {}

  public record Preview(String token, List<Match> matches, boolean truncated) {}

  public record State(
      String name,
      String category,
      String budgetId,
      String budgetCategory,
      boolean legacy,
      String legacyBudget,
      String ruleId,
      Long ruleVersion,
      String ruleTitle,
      String ruleName,
      String ruleCategory,
      String ruleBudget,
      String nameOverride,
      String categoryOverride,
      String budgetOverrideId,
      String budgetOverrideCategory,
      boolean rulesDisabled) {}

  public record Change(String transactionId, State before, String afterFingerprint) {}

  public record Changes(List<Change> changes) {}

  public record ApplicationView(
      String id, String ruleId, Instant createdAt, Instant undoneAt, int changed) {}

  public record AccountScope(String id, String label) {}

  public String userId(AuthenticatedUser auth) {
    if (auth == null || auth.userId() == null || auth.userId().isBlank())
      throw error(HttpStatus.UNAUTHORIZED, "Authentication required");
    return auth.userId();
  }

  @Transactional(readOnly = true)
  public List<RuleView> list(AuthenticatedUser auth) {
    return rules.findByUser_IdOrderByPriorityAscCreatedAtAscIdAsc(userId(auth)).stream()
        .map(this::view)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<ApplicationView> history(AuthenticatedUser auth) {
    return applications.findTop20ByUser_IdOrderByCreatedAtDesc(userId(auth)).stream()
        .map(b ->
            new ApplicationView(
                b.getId(),
                b.getRuleId(),
                b.getCreatedAt(),
                b.getUndoneAt(),
                mapper.readValue(b.getChangesJson(), Changes.class).changes().size()))
        .toList();
  }

  @Transactional(readOnly = true)
  public List<AccountScope> accounts(AuthenticatedUser auth) {
    return transactions.findByUser_IdOrderByDateDesc(userId(auth)).stream()
        .map(Transaction::getPlaidAccountId)
        .filter(Objects::nonNull)
        .distinct()
        .map(id ->
            new AccountScope(
                id, "Imported account ••••" + id.substring(Math.max(0, id.length() - 4))))
        .toList();
  }

  @Transactional
  public RuleView save(AuthenticatedUser auth, String id, RuleRequest request) {
    String userId = userId(auth);
    classification.lock(userId);
    if (!Set.of("MERCHANT", "DESCRIPTION").contains(request.field())
        || !Set.of("EXACT", "NORMALIZED_EXACT", "CONTAINS").contains(request.matchMode())
        || TransactionClassificationService.normalize(request.matchText()).isBlank())
      throw error(HttpStatus.BAD_REQUEST, "Choose a supported matching condition");
    if (request.direction() != null && !Set.of("INCOME", "EXPENSE").contains(request.direction()))
      throw error(HttpStatus.BAD_REQUEST, "Invalid direction");
    if (blank(request.category()) == null
        && blank(request.budgetCategory()) == null
        && blank(request.displayName()) == null)
      throw error(HttpStatus.BAD_REQUEST, "Choose at least one action");
    if (request.accountId() != null
        && transactions.findByUser_IdOrderByDateDesc(userId).stream()
            .noneMatch(t -> request.accountId().equals(t.getPlaidAccountId())))
      throw error(HttpStatus.BAD_REQUEST, "Account scope must belong to your imported history");
    CategorizationRule rule;
    if (id == null) {
      if (rules.findByUser_IdOrderByPriorityAscCreatedAtAscIdAsc(userId).size() >= 100)
        throw error(HttpStatus.BAD_REQUEST, "Limit of 100 rules reached");
      rule = new CategorizationRule();
      rule.setId(UUID.randomUUID().toString());
      rule.setCreatedAt(
          Objects.requireNonNull(
                  jdbc.queryForObject("SELECT clock_timestamp()", java.sql.Timestamp.class))
              .toInstant());
      rule.setUser(
          users
              .findById(userId)
              .orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "User not found")));
    } else {
      rule = owned(userId, id);
      if (request.revision() == null || request.revision() != rule.getRevision())
        throw error(HttpStatus.CONFLICT, "Rule changed. Reload it before saving");
      rule.setRevision(rule.getRevision() + 1);
    }
    rule.setEffectiveAt(
        Objects.requireNonNull(
                jdbc.queryForObject("SELECT clock_timestamp()", java.sql.Timestamp.class))
            .toInstant());
    rule.setTitle(request.title().trim());
    rule.setField(request.field());
    rule.setMatchMode(request.matchMode());
    rule.setMatchText(request.matchText().trim());
    rule.setDirection(blank(request.direction()));
    rule.setAccountId(blank(request.accountId()));
    rule.setProviderCategoryCondition(blank(request.providerCategoryCondition()));
    rule.setCategory(CategoryNormalizer.normalize(request.category()));
    rule.setBudgetCategory(CategoryNormalizer.normalize(request.budgetCategory()));
    rule.setDisplayName(blank(request.displayName()));
    rule.setPriority(request.priority());
    rule.setEnabled(request.enabled());
    return view(rules.saveAndFlush(rule));
  }

  @Transactional
  public void delete(AuthenticatedUser auth, String id, long revision) {
    String userId = userId(auth);
    classification.lock(userId);
    CategorizationRule rule = owned(userId, id);
    if (revision != rule.getRevision())
      throw error(HttpStatus.CONFLICT, "Rule changed. Reload before deleting");
    rules.delete(rule);
  }

  @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;

  @Transactional(
      readOnly = true,
      isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public Preview preview(AuthenticatedUser auth, String id) {
    String userId = userId(auth);
    return computePreview(userId, owned(userId, id));
  }

  public Preview computePreview(String userId, CategorizationRule target) {
    List<Match> matches = new ArrayList<>();
    List<String> fingerprints = new ArrayList<>();
    var allRules = rules.findByUser_IdOrderByPriorityAscCreatedAtAscIdAsc(userId);
    var page = org.springframework.data.domain.PageRequest.ofSize(256);
    var batch =
        target.isEnabled() ? transactions.previewFirst(userId, page) : List.<Transaction>of();
    while (!batch.isEmpty()) {
      for (Transaction tx : batch) {
        if (classification.matches(target, tx)) {
          if (matches.size() >= 500)
            throw error(
                HttpStatus.BAD_REQUEST,
                "More than 500 matches. Narrow the rule before historical application");
          List<String> matchingIds =
              classification.matching(tx, allRules).stream()
                  .map(CategorizationRule::getId)
                  .toList();
          var projection =
              ClassificationPolicy.historicalPreview(
                  target.getId(),
                  matchingIds,
                  tx.isRulesDisabled(),
                  tx.getNameOverride(),
                  tx.getCategoryOverride(),
                  tx.getBudgetOverrideCategory());
          // Resolving budget intent can read an anchor. Keep that work on the winning path.
          var decision =
              projection.projectsTarget()
                  ? classification.decision(
                      tx, target.getDisplayName(), target.getCategory(), target.getBudgetCategory())
                  : new TransactionClassificationService.Decision(
                      tx.getName(),
                      tx.getCategory(),
                      tx.getBudget() == null ? null : tx.getBudget().getCategory());
          matches.add(
              new Match(
                  tx.getId(),
                  tx.getName(),
                  tx.getCategory(),
                  tx.getBudget() == null ? null : tx.getBudget().getCategory(),
                  decision.name(),
                  decision.category(),
                  decision.budgetCategory(),
                  projection.protectedOverride(),
                  matchingIds,
                  projection.winnerId()));
          fingerprints.add(fingerprint(tx));
        }
        entityManager.detach(tx);
      }
      if (batch.size() < page.getPageSize()) break;
      Transaction last = batch.get(batch.size() - 1);
      batch = transactions.previewAfter(userId, last.getDate(), last.getId(), page);
    }
    String token =
        hash(
            json(
                List.of(
                    userId,
                    view(target),
                    allRules.stream().map(this::view).toList(),
                    matches,
                    fingerprints)));
    return new Preview(token, List.copyOf(matches), false);
  }

  @Transactional
  public State reset(AuthenticatedUser auth, String id, boolean automatic) {
    String userId = userId(auth);
    classification.lock(userId);
    Transaction tx =
        transactions
            .findByIdAndUser_Id(id, userId)
            .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Transaction not found"));
    tx.setNameOverride(null);
    tx.setCategoryOverride(null);
    tx.setBudgetOverrideId(null);
    tx.setBudgetOverrideCategory(null);
    tx.setAppliedRuleId(null);
    tx.setAppliedRuleVersion(null);
    tx.setRuleTitle(null);
    tx.setRuleDisplayName(null);
    tx.setRuleCategory(null);
    tx.setRuleBudgetCategory(null);
    tx.setLegacyClassification(false);
    tx.setRulesDisabled(!automatic);
    if (automatic)
      classification.matching(tx).stream()
          .findFirst()
          .ifPresent(rule -> classification.snapshot(tx, rule));
    classification.classify(tx);
    return state(tx);
  }

  public CategorizationRule owned(String userId, String id) {
    return rules
        .findByIdAndUser_Id(id, userId)
        .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Rule not found"));
  }

  private RuleView view(CategorizationRule r) {
    return new RuleView(
        r.getId(),
        r.getTitle(),
        r.getField(),
        r.getMatchMode(),
        r.getMatchText(),
        r.getDirection(),
        r.getAccountId(),
        r.getProviderCategoryCondition(),
        r.getCategory(),
        r.getBudgetCategory(),
        r.getDisplayName(),
        r.getPriority(),
        r.isEnabled(),
        r.getRevision(),
        r.getCreatedAt(),
        r.getEffectiveAt());
  }

  public State state(Transaction t) {
    return new State(
        t.getName(),
        t.getCategory(),
        t.getBudget() == null ? null : t.getBudget().getId(),
        t.getBudget() == null ? null : t.getBudget().getCategory(),
        t.isLegacyClassification(),
        t.getLegacyBudgetCategory(),
        t.getAppliedRuleId(),
        t.getAppliedRuleVersion(),
        t.getRuleTitle(),
        t.getRuleDisplayName(),
        t.getRuleCategory(),
        t.getRuleBudgetCategory(),
        t.getNameOverride(),
        t.getCategoryOverride(),
        t.getBudgetOverrideId(),
        t.getBudgetOverrideCategory(),
        t.isRulesDisabled());
  }

  public String fingerprint(Transaction t) {
    return hash(
        json(
            Arrays.asList(
                t.getId(),
                state(t),
                t.getDate(),
                t.getAmount(),
                t.getType(),
                t.isTransfer(),
                t.getProviderName(),
                t.getProviderCategory(),
                t.getPlaidPending(),
                t.getDescription(),
                t.getPlaidAccountId(),
                t.getPlaidItemId(),
                t.getPlaidPfcDetailed())));
  }

  private String json(Object value) {
    return mapper.writeValueAsString(value);
  }

  private String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Fingerprint unavailable");
    }
  }

  private static String blank(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static ResponseStatusException error(HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }
}
