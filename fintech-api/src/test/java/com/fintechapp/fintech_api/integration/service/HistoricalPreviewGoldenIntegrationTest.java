package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.RuleApplication;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.RuleApplicationRepository;
import com.fintechapp.fintech_api.service.CategorizationRuleService;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class HistoricalPreviewGoldenIntegrationTest extends BaseIntegrationTest {
  private static final String PATH = "/api/categorization-rules/";
  private static final Instant DATE = Instant.parse("2024-02-01T00:00:00Z");

  @Autowired private EntityManager entities;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private CategorizationRuleService rules;
  @Autowired private RuleApplicationRepository applications;

  @Test
  void fixedHttpPreviewVariantsAndApplyJournalMatchOriginalBytes() throws Exception {
    var generated = createUser("preview-golden@example.com", "Password123!", "Golden owner");
    entities.flush();
    entities.clear();
    assertEquals(
        1, jdbc.update("update users set id = ? where id = ?", "golden-owner", generated.getId()));
    var owner = userRepository.findById("golden-owner").orElseThrow();
    var auth = new AuthenticatedUser(owner.getId(), owner.getEmail(), 0);
    var manual = transaction(owner);
    manual.setNameOverride("Manual name");
    manual.setCategoryOverride("");
    manual.setBudgetOverrideCategory("Explicit");
    var disabled = transaction(owner);
    disabled.setRulesDisabled(true);
    var legacy = transaction(owner);
    legacy.setLegacyClassification(true);
    legacy.setLegacyName("Legacy name");
    legacy.setLegacyCategory("Legacy category");
    legacy.setAppliedRuleId("previous-rule");
    legacy.setAppliedRuleVersion(7L);
    var budget = createBudget(owner, "Coffee", 10, DATE);
    var anchor = createBudget(owner, "Anchor", 10, DATE);
    var winner = save(auth, "Coffee", 1, true);
    var loser = save(auth, "Travel", 2, true);
    var off = save(auth, "Other", 0, false);
    entities.flush();
    entities.clear();
    rename("transactions", manual.getId(), "golden-a");
    rename("transactions", disabled.getId(), "golden-b");
    rename("transactions", legacy.getId(), "golden-c");
    rename("budgets", budget.getId(), "golden-coffee");
    rename("budgets", anchor.getId(), "golden-anchor");
    assertEquals(
        1,
        jdbc.update(
            "update transactions set budget_override_id = ? where id = ?",
            "golden-anchor",
            "golden-a"));
    assertEquals(
        1,
        jdbc.update(
            "update transactions set budget_id = ? where id = ?", "golden-coffee", "golden-b"));
    pinRule(winner.id(), "golden-winner");
    pinRule(loser.id(), "golden-loser");
    pinRule(off.id(), "golden-disabled");

    String winning = preview(owner, "golden-winner");
    String losing = preview(owner, "golden-loser");
    String disabledTarget = preview(owner, "golden-disabled");
    var other = createUser("preview-golden-other@example.com", "Password123!", "Other");
    mockMvc
        .perform(post(PATH + "golden-winner/preview").header(authHeaderName(), authHeader(other)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Rule not found"));

    String token = objectMapper.readTree(winning).at("/data/token").asString();
    String applied =
        mockMvc
            .perform(
                post(PATH + "golden-winner/apply")
                    .header(authHeaderName(), authHeader(owner))
                    .contentType(json())
                    .content(asJson(new Apply(token))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.changed").value(2))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String batchId = objectMapper.readTree(applied).at("/data/applicationId").asString();
    String journal =
        applications.findByIdAndUser_Id(batchId, owner.getId()).orElseThrow().getChangesJson();
    String originalJournal;
    try (var fixture =
            getClass().getResourceAsStream("/categorization/historical-preview-golden.jsonl");
        var hashes =
            getClass().getResourceAsStream("/categorization/historical-preview-hashes.txt")) {
      assertNotNull(fixture);
      assertNotNull(hashes);
      String expected = new String(fixture.readAllBytes(), StandardCharsets.UTF_8);
      // Restore the original synthetic SHA-256 hashes before comparing the response bytes.
      String[] tokens = new String(hashes.readAllBytes(), StandardCharsets.UTF_8).split("\\R");
      assertEquals(3, tokens.length);
      for (int i = 0; i < tokens.length; i++) {
        expected = expected.replace("GOLDEN_HASH_" + i, tokens[i]);
      }
      originalJournal = expected.lines().skip(3).findFirst().orElseThrow();
      String observed = String.join("\n", winning, losing, disabledTarget, journal) + "\n";
      assertArrayEquals(
          expected.getBytes(StandardCharsets.UTF_8), observed.getBytes(StandardCharsets.UTF_8));
    }
    mockMvc
        .perform(
            post(PATH + "golden-winner/apply")
                .header(authHeaderName(), authHeader(owner))
                .contentType(json())
                .content(asJson(new Apply(token))))
        .andExpect(status().isConflict())
        .andExpect(
            jsonPath("$.message").value("History or rules changed. Preview again before applying"));

    // Feed the original writer's stored bytes to the unchanged undo reader.
    var originalBatch = new RuleApplication();
    originalBatch.setId("golden-original-batch");
    originalBatch.setUser(owner);
    originalBatch.setRuleId("golden-winner");
    originalBatch.setCreatedAt(DATE);
    originalBatch.setChangesJson(originalJournal);
    applications.saveAndFlush(originalBatch);
    assertEquals(2, rules.undo(auth, originalBatch.getId()).changed());
    assertEquals(0, rules.undo(auth, originalBatch.getId()).changed());
    assertEquals(
        "Manual name", transactionRepository.findById("golden-a").orElseThrow().getNameOverride());
    assertEquals(
        "previous-rule",
        transactionRepository.findById("golden-c").orElseThrow().getAppliedRuleId());
  }

  @Test
  void emptyPreviewCanBeReplayedAndPersistsDistinctEmptyBatches() throws Exception {
    var owner = createUser("history-empty@example.com", "Password123!", "Empty history");
    var auth = new AuthenticatedUser(owner.getId(), owner.getEmail(), 0);
    var rule = save(auth, "Coffee", 1, true);
    String token = objectMapper.readTree(preview(owner, rule.id())).at("/data/token").asString();

    String first = applyEmpty(owner, rule.id(), token);
    String second = applyEmpty(owner, rule.id(), token);

    assertNotEquals(first, second);
    assertEquals(first, java.util.UUID.fromString(first).toString());
    assertEquals(second, java.util.UUID.fromString(second).toString());
    assertEquals(
        "{\"changes\":[]}",
        applications.findByIdAndUser_Id(first, owner.getId()).orElseThrow().getChangesJson());
    assertEquals(
        "{\"changes\":[]}",
        applications.findByIdAndUser_Id(second, owner.getId()).orElseThrow().getChangesJson());
  }

  private String applyEmpty(User owner, String ruleId, String token) throws Exception {
    String response =
        mockMvc
            .perform(
                post(PATH + ruleId + "/apply")
                    .header(authHeaderName(), authHeader(owner))
                    .contentType(json())
                    .content(asJson(new Apply(token))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.changed").value(0))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    String id = objectMapper.readTree(response).at("/data/applicationId").asString();
    assertEquals(
        "{\"success\":true,\"data\":{\"applicationId\":\"" + id + "\",\"changed\":0}}", response);
    return id;
  }

  private String preview(User owner, String id) throws Exception {
    return mockMvc
        .perform(post(PATH + id + "/preview").header(authHeaderName(), authHeader(owner)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString(StandardCharsets.UTF_8);
  }

  private Transaction transaction(User owner) {
    return createTransaction(owner, null, "Shop", DATE, "Old", TransactionType.EXPENSE, 12);
  }

  private CategorizationRuleService.RuleView save(
      AuthenticatedUser auth, String category, int priority, boolean enabled) {
    return rules.save(
        auth,
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
            "Proposed",
            priority,
            enabled,
            null));
  }

  private void rename(String table, String previous, String fixed) {
    assertEquals(1, jdbc.update("update " + table + " set id = ? where id = ?", fixed, previous));
  }

  private void pinRule(String previous, String fixed) {
    assertEquals(
        1,
        jdbc.update(
            "update categorization_rules set id = ?, created_at = ?, effective_at = ? where id = ?",
            fixed,
            Timestamp.from(DATE),
            Timestamp.from(DATE),
            previous));
  }

  private record Apply(String token) {}
}
