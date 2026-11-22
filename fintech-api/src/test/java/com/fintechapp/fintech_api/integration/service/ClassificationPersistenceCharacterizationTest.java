package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.RuleApplicationRepository;
import com.fintechapp.fintech_api.service.CategorizationRuleService;
import com.fintechapp.fintech_api.service.CategorizationRuleService.Match;
import com.fintechapp.fintech_api.service.CategorizationRuleService.State;
import com.fintechapp.fintech_api.service.TransactionClassificationService;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ClassificationPersistenceCharacterizationTest extends BaseIntegrationTest {
  private static final Instant FIRST = Instant.parse("2024-02-01T00:00:00Z");
  private static final Instant NEXT = Instant.parse("2024-03-01T00:00:00Z");
  private static final Instant EFFECTIVE = Instant.parse("2024-02-10T12:00:00Z");

  @Autowired private CategorizationRuleService rules;
  @Autowired private TransactionClassificationService classification;
  @Autowired private RuleApplicationRepository applications;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private EntityManager em;

  @Test
  void persistedOrderingAndInclusiveEffectiveTimeDifferFromHistoricalPreview() {
    var user = owner();
    var a = save(user, "A", 1);
    var b = save(user, "B", 1);
    var later = save(user, "C", 1);
    var low = save(user, "D", 2);
    pinTimes(a.id(), FIRST, EFFECTIVE);
    pinTimes(b.id(), FIRST, EFFECTIVE);
    pinTimes(later.id(), FIRST.plusSeconds(1), EFFECTIVE);
    pinTimes(low.id(), FIRST.minusSeconds(1), EFFECTIVE.minusSeconds(2));
    em.clear();
    var tied =
        List.of(a, b).stream()
            .sorted(Comparator.comparing(CategorizationRuleService.RuleView::id))
            .toList();
    var before = transaction(user);
    before.setCreatedAt(EFFECTIVE.minusNanos(1000));
    classification.classify(before);
    assertEquals(low.id(), before.getAppliedRuleId());

    var exact = transaction(user);
    exact.setCreatedAt(EFFECTIVE);
    classification.classify(exact);
    assertEquals(tied.get(0).id(), exact.getAppliedRuleId());

    var undated = transaction(user);
    undated.setCreatedAt(null);
    classification.classify(undated);
    assertEquals(tied.get(0).id(), undated.getAppliedRuleId());

    var expectedOrder = List.of(tied.get(0).id(), tied.get(1).id(), later.id(), low.id());
    var preview = rules.preview(auth(user), tied.get(0).id());
    var match =
        preview.matches().stream()
            .filter(row -> row.id().equals(before.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(expectedOrder, match.matchingRules());
    assertEquals(tied.get(0).id(), match.winnerId());
    assertEquals(tied.get(0).category(), match.proposedCategory());
  }

  @Test
  void ownedAnchorCategoryCarriesAcrossMonthsButForeignAnchorCannotWin() {
    var user = owner();
    var other = owner();
    var tx = transaction(user);
    var anchor = createBudget(user, "Anchor", 100, FIRST);
    var foreign = createBudget(other, "Foreign", 100, FIRST);
    tx.setBudgetOverrideCategory("Explicit");
    tx.setBudgetOverrideId(anchor.getId());
    classification.classify(tx, false, false);
    assertEquals(anchor.getId(), tx.getBudget().getId());
    assertEquals(12, tx.getBudget().getSpent());

    tx.setDate(NEXT);
    classification.classify(tx, false, false);
    assertNotEquals(anchor.getId(), tx.getBudget().getId());
    assertEquals(NEXT, tx.getBudget().getDate());
    assertEquals("Anchor", tx.getBudget().getCategory());
    assertTrue(tx.getBudget().isAutoCreated());
    assertEquals(12, tx.getBudget().getSpent());

    tx.setBudgetOverrideId(foreign.getId());
    classification.classify(tx, false, false);
    assertEquals("Explicit", tx.getBudget().getCategory());
    assertEquals(user.getId(), tx.getBudget().getUser().getId());
    em.flush();
    em.clear();
    assertEquals(0, budgetRepository.findById(anchor.getId()).orElseThrow().getSpent());
    assertEquals(0, budgetRepository.findById(foreign.getId()).orElseThrow().getSpent());
  }

  @Test
  void previewTokenAndStoredUndoFingerprintRetainTheirOrderedInputs() throws Exception {
    var user = owner();
    var tx = transaction(user);
    Instant dbBefore = jdbc.queryForObject("select clock_timestamp()", Timestamp.class).toInstant();
    var rule = save(user, "Coffee", 1);
    Instant dbAfter = jdbc.queryForObject("select clock_timestamp()", Timestamp.class).toInstant();
    assertFalse(rule.createdAt().isBefore(dbBefore));
    assertFalse(rule.effectiveAt().isBefore(rule.createdAt()));
    assertFalse(rule.effectiveAt().isAfter(dbAfter));

    var before =
        new State(
            "Shop", "Old", null, null, false, null, null, null, null, null, null, null, null, null,
            null, null, false);
    assertEquals(
        List.of(
            "name",
            "category",
            "budgetId",
            "budgetCategory",
            "legacy",
            "legacyBudget",
            "ruleId",
            "ruleVersion",
            "ruleTitle",
            "ruleName",
            "ruleCategory",
            "ruleBudget",
            "nameOverride",
            "categoryOverride",
            "budgetOverrideId",
            "budgetOverrideCategory",
            "rulesDisabled"),
        List.copyOf(objectMapper.valueToTree(before).propertyNames()));
    var match =
        new Match(
            tx.getId(),
            "Shop",
            "Old",
            null,
            "Shop",
            "Coffee",
            "Coffee",
            false,
            List.of(rule.id()),
            rule.id());
    assertEquals(
        List.of(
            "id",
            "title",
            "field",
            "matchMode",
            "matchText",
            "direction",
            "accountId",
            "providerCategoryCondition",
            "category",
            "budgetCategory",
            "displayName",
            "priority",
            "enabled",
            "revision",
            "createdAt",
            "effectiveAt"),
        List.copyOf(objectMapper.valueToTree(rule).propertyNames()));
    assertEquals(
        List.of(
            "id",
            "name",
            "category",
            "budgetCategory",
            "proposedName",
            "proposedCategory",
            "proposedBudgetCategory",
            "protectedOverride",
            "matchingRules",
            "winnerId"),
        List.copyOf(objectMapper.valueToTree(match).propertyNames()));
    var preview = rules.preview(auth(user), rule.id());
    assertEquals(List.of(match), preview.matches());
    assertFalse(preview.truncated());
    assertEquals(
        hash(
            List.of(
                user.getId(),
                rule,
                List.of(rule),
                List.of(match),
                List.of(fingerprint(tx, before)))),
        preview.token());

    var batch = rules.apply(auth(user), rule.id(), preview.token());
    assertEquals(1, batch.changed());
    var saved = applications.findByIdAndUser_Id(batch.applicationId(), user.getId()).orElseThrow();
    var applied = transactionRepository.findById(tx.getId()).orElseThrow();
    var after =
        new State(
            "Shop",
            "Coffee",
            applied.getBudget().getId(),
            "Coffee",
            false,
            null,
            rule.id(),
            rule.revision(),
            rule.title(),
            null,
            "Coffee",
            null,
            null,
            null,
            null,
            null,
            false);
    assertEquals(
        objectMapper.writeValueAsString(
            new CategorizationRuleService.Changes(
                List.of(
                    new CategorizationRuleService.Change(
                        tx.getId(), before, fingerprint(applied, after))))),
        saved.getChangesJson());
    assertEquals(1, rules.undo(auth(user), batch.applicationId()).changed());
    // Undo restores provenance, then recomputes display values. This fixture has no provider
    // category.
    assertEquals(
        "Uncategorized", transactionRepository.findById(tx.getId()).orElseThrow().getCategory());
  }

  @Test
  void historicalPreviewAcceptsFiveHundredMatchesAndRejectsTheNextOne() {
    var user = owner();
    var rule = save(user, "Coffee", 1);
    for (int i = 0; i < 500; i++) transaction(user);
    var preview = rules.preview(auth(user), rule.id());
    assertEquals(500, preview.matches().size());
    assertFalse(preview.truncated());
    var ids = preview.matches().stream().map(Match::id).toList();
    assertEquals(ids.stream().sorted().toList(), ids);
    transaction(user);
    var error =
        assertThrows(
            org.springframework.web.server.ResponseStatusException.class,
            () -> rules.preview(auth(user), rule.id()));
    assertEquals(400, error.getStatusCode().value());
    assertEquals(
        "More than 500 matches. Narrow the rule before historical application", error.getReason());
  }

  private String fingerprint(Transaction tx, State state) throws Exception {
    return hash(
        Arrays.asList(
            tx.getId(),
            state,
            tx.getDate(),
            tx.getAmount(),
            tx.getType(),
            tx.isTransfer(),
            tx.getProviderName(),
            tx.getProviderCategory(),
            tx.getPlaidPending(),
            tx.getDescription(),
            tx.getPlaidAccountId(),
            tx.getPlaidItemId(),
            tx.getPlaidPfcDetailed()));
  }

  private String hash(Object orderedInputs) throws Exception {
    return HexFormat.of()
        .formatHex(
            MessageDigest.getInstance("SHA-256")
                .digest(
                    objectMapper
                        .writeValueAsString(orderedInputs)
                        .getBytes(StandardCharsets.UTF_8)));
  }

  private User owner() {
    return createUser(
        "classification-" + UUID.randomUUID() + "@example.com", "Password123!", "Rule test");
  }

  private static AuthenticatedUser auth(User user) {
    return new AuthenticatedUser(user.getId(), user.getEmail(), 0);
  }

  private Transaction transaction(User user) {
    return createTransaction(user, null, "Shop", FIRST, "Old", TransactionType.EXPENSE, 12);
  }

  private CategorizationRuleService.RuleView save(User user, String category, int priority) {
    return rules.save(
        auth(user),
        null,
        new RuleRequest(
            "Shop rule",
            "MERCHANT",
            "EXACT",
            "Shop",
            null,
            null,
            null,
            category,
            null,
            null,
            priority,
            true,
            null));
  }

  private void pinTimes(String id, Instant createdAt, Instant effectiveAt) {
    assertEquals(
        1,
        jdbc.update(
            "update categorization_rules set created_at = ?, effective_at = ? where id = ?",
            Timestamp.from(createdAt),
            Timestamp.from(effectiveAt),
            id));
  }
}
