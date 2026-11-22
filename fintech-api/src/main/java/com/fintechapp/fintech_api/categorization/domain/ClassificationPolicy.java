package com.fintechapp.fintech_api.categorization.domain;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.OptionalInt;

public final class ClassificationPolicy {
  private ClassificationPolicy() {}

  public record MatchFacts(
      String direction,
      String accountId,
      String providerCategory,
      String description,
      String providerName,
      String currentName) {}

  public record RuleCondition(
      boolean enabled,
      String direction,
      String accountId,
      String providerCategory,
      String field,
      String mode,
      String text) {}

  public record DisplayFacts(
      String currentName,
      String currentCategory,
      String providerName,
      String providerCategory,
      String nameOverride,
      String categoryOverride,
      String budgetOverrideCategory,
      boolean legacy,
      String legacyName,
      String legacyCategory,
      String legacyBudgetCategory,
      boolean expense,
      boolean transfer) {}

  public record RuleActions(String name, String category, String budgetCategory) {}

  /** A present anchor has already been scoped to the owner. Its month is irrelevant to intent. */
  public record OwnedBudgetAnchor(String category) {}

  public record Decision(String name, String category, String budgetCategory) {}

  public static String normalize(String text) {
    return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^\\p{L}\\p{N}]+", " ")
        .trim();
  }

  public static boolean matches(RuleCondition rule, MatchFacts transaction) {
    if (!rule.enabled()) return false;
    if (rule.direction() != null
        && !rule.direction().equals(Objects.requireNonNull(transaction.direction()))) return false;
    if (rule.accountId() != null && !rule.accountId().equals(transaction.accountId())) return false;
    if (rule.providerCategory() != null
        && !normalize(rule.providerCategory()).equals(normalize(transaction.providerCategory())))
      return false;
    String value =
        "DESCRIPTION".equals(rule.field())
            ? transaction.description()
            : transaction.providerName() != null
                ? transaction.providerName()
                : transaction.currentName();
    return switch (rule.mode()) {
      case "EXACT" -> Objects.equals(value, rule.text());
      case "NORMALIZED_EXACT" -> normalize(value).equals(normalize(rule.text()));
      case "CONTAINS" -> normalize(value).contains(normalize(rule.text()));
      default -> false;
    };
  }

  public static boolean permitsLiveSelection(
      boolean selectRules, String appliedRuleId, boolean legacy, boolean rulesDisabled) {
    return selectRules && appliedRuleId == null && !legacy && !rulesDisabled;
  }

  /**
   * Returns the position in the supplied, already matched list. Historical callers use its first
   * item.
   */
  public static OptionalInt firstEffectiveMatch(
      Instant transactionCreatedAt, List<Instant> effectiveTimes) {
    for (int index = 0; index < effectiveTimes.size(); index++) {
      if (transactionCreatedAt == null
          || !transactionCreatedAt.isBefore(effectiveTimes.get(index))) {
        return OptionalInt.of(index);
      }
    }
    return OptionalInt.empty();
  }

  public static Decision decide(
      DisplayFacts transaction, RuleActions rule, OwnedBudgetAnchor anchor) {
    String name =
        transaction.nameOverride() != null
            ? transaction.nameOverride()
            : rule.name() != null
                ? rule.name()
                : transaction.legacy()
                    ? transaction.legacyName() != null
                        ? transaction.legacyName()
                        : transaction.currentName()
                    : transaction.providerName() != null
                        ? transaction.providerName()
                        : transaction.currentName();
    String category =
        transaction.categoryOverride() != null
            ? transaction.categoryOverride()
            : rule.category() != null
                ? rule.category()
                : transaction.legacy()
                    ? transaction.legacyCategory() != null
                        ? transaction.legacyCategory()
                        : transaction.currentCategory()
                    : transaction.providerCategory() != null
                        ? transaction.providerCategory()
                        : "Uncategorized";
    String budgetCategory =
        anchor == null ? transaction.budgetOverrideCategory() : anchor.category();
    if (budgetCategory == null) budgetCategory = rule.budgetCategory();
    if (budgetCategory == null && transaction.legacy())
      budgetCategory = transaction.legacyBudgetCategory();
    if (budgetCategory == null) budgetCategory = category;
    if (!transaction.expense() || transaction.transfer()) budgetCategory = null;
    return new Decision(
        name == null || name.isBlank() ? "Unknown transaction" : name, category, budgetCategory);
  }
}
