package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fintechapp.fintech_api.model.CategorizationRule;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import java.util.List;
import org.junit.jupiter.api.Test;

class ClassificationCharacterizationTest {

  // These paths evaluate only the supplied facts. Database behavior is tested separately.
  private final TransactionClassificationService service =
      new TransactionClassificationService(null, null, null, null, null);

  @Test
  void rawExactUsesProviderNameAndDescriptionWithoutNormalization() {
    var tx = expense();
    tx.setProviderName("Shop");
    tx.setName("Displayed");
    tx.setDescription("invoice 42");
    var rule = rule("EXACT", "shop");
    assertFalse(service.matches(rule, tx));
    rule.setMatchText("Shop");
    assertTrue(service.matches(rule, tx));
    rule.setMatchText("Displayed");
    assertFalse(service.matches(rule, tx));
    tx.setProviderName(null);
    assertTrue(service.matches(rule, tx));
    tx.setProviderName("");
    assertFalse(service.matches(rule, tx));
    rule.setField("DESCRIPTION");
    rule.setMatchText("invoice 42");
    assertTrue(service.matches(rule, tx));
    rule.setEnabled(false);
    assertFalse(service.matches(rule, tx));
  }

  @Test
  void unicodeContainsAndEmptyFactsRetainCurrentMatcherSemantics() {
    var tx = expense();
    tx.setProviderName("ＣＡＦＥ\u0301—１２");
    assertTrue(service.matches(rule("NORMALIZED_EXACT", "café 12"), tx));
    assertTrue(service.matches(rule("CONTAINS", "FÉ—12"), tx));
    assertFalse(service.matches(rule("UNSUPPORTED", "café 12"), tx));
    tx.setDescription(null);
    var exact = rule("EXACT", null);
    exact.setField("DESCRIPTION");
    assertTrue(service.matches(exact, tx));
    exact.setMatchMode("NORMALIZED_EXACT");
    exact.setMatchText(" — ");
    assertTrue(service.matches(exact, tx));
    assertTrue(service.matches(rule("CONTAINS", " "), tx));
    assertNull(CategoryNormalizer.normalize(" "));
    assertEquals("", TransactionClassificationService.normalize(" "));
  }

  @Test
  void directionAndAccountAreExactButProviderCategoryIsNormalized() {
    var tx = expense();
    tx.setName("Shop");
    tx.setPlaidAccountId("account-A");
    tx.setProviderCategory("ＦＯＯＤ—ＤＲＩＮＫ");
    var rule = rule("EXACT", "Shop");
    rule.setDirection("EXPENSE");
    rule.setAccountId("account-A");
    rule.setProviderCategoryCondition("food drink");
    assertTrue(service.matches(rule, tx));
    rule.setDirection("expense");
    assertFalse(service.matches(rule, tx));
    rule.setDirection(null);
    rule.setAccountId("account-a");
    assertFalse(service.matches(rule, tx));
    rule.setAccountId(null);
    tx.setProviderCategory(null);
    assertFalse(service.matches(rule, tx));
    rule.setProviderCategoryCondition(" ");
    assertTrue(service.matches(rule, tx));
  }

  @Test
  void suppliedCandidatesRetainTheirOriginalOrder() {
    var tx = expense();
    tx.setName("Shop");
    var first = rule("EXACT", "Shop");
    first.setPriority(10);
    var second = rule("CONTAINS", "Shop");
    second.setPriority(1);
    assertEquals(
        List.of(first, second), service.matching(tx, List.of(first, rule("EXACT", "no"), second)));
  }

  @Test
  void displayAndBudgetPrecedenceUsesFirstNonNullValuesAndFinalNameFallback() {
    var tx = expense();
    tx.setName("Old name");
    tx.setCategory("Old category");
    tx.setProviderName("Provider name");
    tx.setProviderCategory("Provider category");
    assertDecision(tx, null, null, null, "Provider name", "Provider category", "Provider category");
    tx.setLegacyClassification(true);
    assertDecision(tx, null, null, null, "Old name", "Old category", "Old category");
    tx.setLegacyName("Legacy name");
    tx.setLegacyCategory("Legacy category");
    tx.setLegacyBudgetCategory("Legacy budget");
    assertDecision(tx, null, null, null, "Legacy name", "Legacy category", "Legacy budget");
    assertDecision(
        tx,
        "Rule name",
        "Rule category",
        "Rule budget",
        "Rule name",
        "Rule category",
        "Rule budget");
    tx.setNameOverride(" ");
    tx.setCategoryOverride("");
    tx.setBudgetOverrideCategory("Manual budget");
    assertDecision(
        tx,
        "Rule name",
        "Rule category",
        "Rule budget",
        "Unknown transaction",
        "",
        "Manual budget");
    tx.setTransfer(true);
    assertDecision(tx, null, null, null, "Unknown transaction", "", null);
    tx.setTransfer(false);
    tx.setType(TransactionType.INCOME);
    assertDecision(tx, null, null, null, "Unknown transaction", "", null);
    assertDecision(
        expense(), null, null, null, "Unknown transaction", "Uncategorized", "Uncategorized");
  }

  private void assertDecision(
      Transaction tx,
      String ruleName,
      String ruleCategory,
      String ruleBudget,
      String name,
      String category,
      String budget) {
    assertEquals(
        new TransactionClassificationService.Decision(name, category, budget),
        service.decision(tx, ruleName, ruleCategory, ruleBudget));
  }

  private static Transaction expense() {
    var tx = new Transaction();
    tx.setType(TransactionType.EXPENSE);
    return tx;
  }

  private static CategorizationRule rule(String mode, String text) {
    var rule = new CategorizationRule();
    rule.setEnabled(true);
    rule.setField("MERCHANT");
    rule.setMatchMode(mode);
    rule.setMatchText(text);
    return rule;
  }
}
