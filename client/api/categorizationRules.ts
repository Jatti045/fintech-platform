import BaseAPI from "./base";
export interface CategorizationRule {
  id: string; title: string; field: "MERCHANT" | "DESCRIPTION"; matchMode: "EXACT" | "NORMALIZED_EXACT" | "CONTAINS";
  matchText: string; direction: string | null; accountId: string | null; providerCategoryCondition: string | null;
  category: string | null; budgetCategory: string | null; displayName: string | null;
  priority: number; enabled: boolean; revision: number; createdAt: string;
}
export type RuleDraft = Omit<CategorizationRule, "id" | "createdAt" | "revision"> & { revision?: number };
export interface RuleMatch { id: string; name: string; category: string; budgetCategory: string | null; proposedName: string; proposedCategory: string; proposedBudgetCategory: string | null; protectedOverride: boolean; matchingRules: string[]; winnerId: string | null }
export interface RulePreview { token: string; matches: RuleMatch[]; truncated: boolean }
export interface RuleApplication { id: string; ruleId: string; createdAt: string; undoneAt: string | null; changed: number }
class CategorizationRulesAPI extends BaseAPI {
  list() { return this.makeRequest<CategorizationRule[]>("/categorization-rules"); }
  history() { return this.makeRequest<RuleApplication[]>("/categorization-rules/applications"); }
  accounts() { return this.makeRequest<{ id: string; label: string }[]>("/categorization-rules/accounts"); }
  save(draft: RuleDraft, id?: string) {
    const { title, field, matchMode, matchText, direction, accountId, providerCategoryCondition,
      category, budgetCategory, displayName, priority, enabled, revision } = draft;
    return this.makeRequest<CategorizationRule>(`/categorization-rules${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      data: { title, field, matchMode, matchText, direction, accountId, providerCategoryCondition,
        category, budgetCategory, displayName, priority, enabled, revision },
    });
  }
  delete(rule: CategorizationRule) { return this.makeRequest<void>(`/categorization-rules/${rule.id}`, { method: "DELETE", params: { revision: rule.revision } }); }
  preview(id: string) { return this.makeRequest<RulePreview>(`/categorization-rules/${id}/preview`, { method: "POST" }); }
  apply(id: string, token: string) { return this.makeRequest<{ applicationId: string; changed: number }>(`/categorization-rules/${id}/apply`, { method: "POST", data: { token } }); }
  undo(id: string) { return this.makeRequest<{ applicationId: string; changed: number }>(`/categorization-rules/applications/${id}/undo`, { method: "POST" }); }
  reset(id: string, automatic = false) { return this.makeRequest(`/transactions/${id}/classification/reset`, { method: "POST", params: { automatic } }); }
}
export default new CategorizationRulesAPI();
