package com.fintechapp.fintech_api.categorization.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy.Decision;
import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy.DisplayFacts;
import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy.MatchFacts;
import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy.OwnedBudgetAnchor;
import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy.RuleActions;
import com.fintechapp.fintech_api.categorization.domain.ClassificationPolicy.RuleCondition;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class ClassificationPolicyTest {
  private static final RuleActions RULE =
      new RuleActions("Rule name", "Rule category", "Rule budget");
  private static final RuleActions NO_ACTIONS = new RuleActions(null, null, null);

  @Test
  void matchesOriginalRawAndNormalizedFields() {
    var transaction =
        new MatchFacts("EXPENSE", "Account-A", "ＦＯＯＤ—ＤＲＩＮＫ", "Invoice", "ＣＡＦＥ\u0301—１２", "Old");
    assertFalse(matches(transaction, "MERCHANT", "EXACT", "café 12"));
    assertTrue(matches(transaction, "MERCHANT", "NORMALIZED_EXACT", "café 12"));
    assertTrue(matches(transaction, "MERCHANT", "CONTAINS", "FÉ-12"));
    assertTrue(matches(transaction, "MERCHANT", "CONTAINS", "—"));
    assertFalse(matches(transaction, "MERCHANT", "UNSUPPORTED", "café 12"));
    assertTrue(matches(transaction, "DESCRIPTION", "EXACT", "Invoice"));
    assertFalse(matches(transaction, "DESCRIPTION", "EXACT", "invoice"));
    assertEquals("café 12", ClassificationPolicy.normalize("ＣＡＦＥ\u0301—１２"));
    assertEquals("", ClassificationPolicy.normalize(null));
  }

  @Test
  void nullAndBlankProviderValuesRemainDistinct() {
    var missing = new MatchFacts("EXPENSE", null, null, null, null, "Old");
    var blank = new MatchFacts("EXPENSE", null, null, null, "", "Old");
    assertTrue(matches(missing, "MERCHANT", "EXACT", "Old"));
    assertFalse(matches(blank, "MERCHANT", "EXACT", "Old"));
    assertTrue(matches(blank, "MERCHANT", "EXACT", ""));
    assertTrue(matches(missing, "DESCRIPTION", "EXACT", null));
    assertTrue(matches(missing, "DESCRIPTION", "NORMALIZED_EXACT", "—"));
  }

  @Test
  void filtersDisabledRulesDirectionAccountAndProviderCategory() {
    var tx = new MatchFacts("EXPENSE", "Account-A", "ＦＯＯＤ—ＤＲＩＮＫ", null, "Shop", null);
    assertTrue(
        ClassificationPolicy.matches(condition(true, "EXPENSE", "Account-A", "food drink"), tx));
    assertFalse(
        ClassificationPolicy.matches(condition(false, "EXPENSE", "Account-A", "food drink"), tx));
    assertFalse(
        ClassificationPolicy.matches(condition(true, "expense", "Account-A", "food drink"), tx));
    assertFalse(
        ClassificationPolicy.matches(condition(true, "EXPENSE", "account-a", "food drink"), tx));
    assertFalse(ClassificationPolicy.matches(condition(true, "EXPENSE", "Account-A", "other"), tx));
  }

  @Test
  void liveSelectionPreservesCallerOrderAndInclusiveEffectiveTime() {
    Instant at = Instant.parse("2024-02-01T00:00:00Z");
    var ordered = List.of(at.plusSeconds(1), at, at.minusSeconds(1));
    assertEquals(1, ClassificationPolicy.firstEffectiveMatch(at, ordered).orElseThrow());
    assertEquals(0, ClassificationPolicy.firstEffectiveMatch(null, ordered).orElseThrow());
    assertEquals(
        0,
        ClassificationPolicy.firstEffectiveMatch(null, Arrays.asList((Instant) null))
            .orElseThrow());
    assertTrue(ClassificationPolicy.firstEffectiveMatch(at.minusSeconds(2), ordered).isEmpty());
    assertTrue(ClassificationPolicy.permitsLiveSelection(true, null, false, false));
    assertFalse(ClassificationPolicy.permitsLiveSelection(false, null, false, false));
    assertFalse(ClassificationPolicy.permitsLiveSelection(true, "snapshot", false, false));
    assertFalse(ClassificationPolicy.permitsLiveSelection(true, null, true, false));
    assertFalse(ClassificationPolicy.permitsLiveSelection(true, null, false, true));
  }

  @Test
  void decisionsPreserveOverridesSnapshotsLegacyFactsAndFallbacks() {
    assertEquals(
        new Decision("Unknown transaction", "", "Explicit"),
        ClassificationPolicy.decide(
            new DisplayFacts(
                "Old",
                "Old",
                "Provider",
                "Provider",
                " ",
                "",
                "Explicit",
                true,
                "Legacy",
                "Legacy",
                "Legacy budget",
                true,
                false),
            RULE,
            null));
    var legacy =
        new DisplayFacts(
            "Old",
            "Old category",
            "Provider",
            "Provider category",
            null,
            null,
            null,
            true,
            "Legacy",
            "Legacy category",
            "Legacy budget",
            true,
            false);
    assertEquals(
        new Decision("Rule name", "Rule category", "Rule budget"),
        ClassificationPolicy.decide(legacy, RULE, null));
    assertEquals(
        new Decision("Legacy", "Legacy category", "Legacy budget"),
        ClassificationPolicy.decide(legacy, NO_ACTIONS, null));
    var provider =
        new DisplayFacts(
            "Old",
            "Old category",
            "Provider",
            "Provider category",
            null,
            null,
            null,
            false,
            null,
            null,
            null,
            true,
            false);
    assertEquals(
        new Decision("Provider", "Provider category", "Provider category"),
        ClassificationPolicy.decide(provider, NO_ACTIONS, null));
    assertEquals(
        new Decision("Unknown transaction", "Uncategorized", "Uncategorized"),
        ClassificationPolicy.decide(
            new DisplayFacts(
                null, null, null, null, null, null, null, false, null, null, null, true, false),
            NO_ACTIONS,
            null));
  }

  @Test
  void budgetIntentUsesOwnedAnchorRegardlessOfMonthAndSuppressesNonAssignments() {
    assertEquals(
        "Anchor",
        ClassificationPolicy.decide(budgetFacts(true, false), RULE, new OwnedBudgetAnchor("Anchor"))
            .budgetCategory());
    // The adapter represents missing or foreign anchors by absence.
    assertEquals(
        "Explicit",
        ClassificationPolicy.decide(budgetFacts(true, false), RULE, null).budgetCategory());
    assertEquals(
        "Rule budget",
        ClassificationPolicy.decide(budgetFacts(true, false), RULE, new OwnedBudgetAnchor(null))
            .budgetCategory());
    assertNull(
        ClassificationPolicy.decide(
                budgetFacts(false, false), RULE, new OwnedBudgetAnchor("Anchor"))
            .budgetCategory());
    assertNull(
        ClassificationPolicy.decide(budgetFacts(true, true), RULE, new OwnedBudgetAnchor("Anchor"))
            .budgetCategory());
  }

  private static DisplayFacts budgetFacts(boolean expense, boolean transfer) {
    return new DisplayFacts(
        "Old",
        "Old",
        null,
        null,
        null,
        null,
        "Explicit",
        false,
        null,
        null,
        null,
        expense,
        transfer);
  }

  private static boolean matches(MatchFacts transaction, String field, String mode, String text) {
    return ClassificationPolicy.matches(
        new RuleCondition(true, null, null, null, field, mode, text), transaction);
  }

  private static RuleCondition condition(
      boolean enabled, String direction, String account, String category) {
    return new RuleCondition(enabled, direction, account, category, "MERCHANT", "EXACT", "Shop");
  }
}
