import React, { useEffect, useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from "react-native";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { api } from "@/store/api/apiSlice";
import rulesAPI, { type CategorizationRule, type RuleDraft, type RulePreview, type RuleApplication } from "@/api/categorizationRules";

const empty = (): RuleDraft => ({ title: "", field: "MERCHANT", matchMode: "NORMALIZED_EXACT", matchText: "", direction: null, accountId: null, providerCategoryCondition: null, category: null, budgetCategory: null, displayName: null, priority: 100, enabled: true });
export default function RulesManager({ visible, onClose, seed }: { visible: boolean; onClose: () => void; seed?: Partial<RuleDraft> }) {
  const { THEME } = useTheme(); const dispatch = useAppDispatch();
  const [rules, setRules] = useState<CategorizationRule[]>([]), [history, setHistory] = useState<RuleApplication[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; label: string }[]>([]);
  const [draft, setDraft] = useState<RuleDraft | null>(null), [editingId, setEditingId] = useState<string>();
  const [preview, setPreview] = useState<{ rule: CategorizationRule; data: RulePreview }>();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [message, setMessage] = useState<string>();
  const reload = async () => {
    const [list, batches, scopes] = await Promise.all([rulesAPI.list(), rulesAPI.history(), rulesAPI.accounts()]);
    setRules(list.data); setHistory(batches.data); setAccounts(scopes.data);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError(undefined); setMessage(undefined);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : e && typeof e === "object" && "error" in e ? String(e.error) : "Could not complete rule action. Try again."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!visible) return;
    setPreview(undefined); setEditingId(undefined); setDraft(seed ? { ...empty(), ...seed } : null);
    void run(reload);
    // Initialization is scoped to each modal opening; user edits remain stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const button = (label: string, action: () => void, disabled = busy) => <TouchableOpacity key={label} disabled={disabled} onPress={action} accessibilityRole="button" accessibilityLabel={label} style={{ padding: 12, borderRadius: 10, backgroundColor: THEME.surfaceHover, marginVertical: 4 }}><Text style={{ color: THEME.primary }}>{label}</Text></TouchableOpacity>;
  const input = (label: string, key: keyof RuleDraft, numeric = false) => <View key={key}><Text style={{ color: THEME.textSecondary, marginTop: 10 }}>{label}</Text><TextInput accessibilityLabel={label} value={String(draft?.[key] ?? "")} editable={!busy} keyboardType={numeric ? "number-pad" : "default"} onChangeText={value => setDraft(d => d ? { ...d, [key]: numeric ? Number(value) : value || null } : d)} style={{ color: THEME.textPrimary, padding: 10, borderWidth: 1, borderColor: THEME.border, borderRadius: 8 }} /></View>;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: THEME.background, padding: 20, paddingTop: 50 }}>
      <Text style={{ color: THEME.textPrimary, fontSize: 22, fontWeight: "700" }}>Transaction rules</Text>
      {button("Close rules", onClose)}
      {busy && <ActivityIndicator color={THEME.primary} />}
      {error && <Text accessibilityLiveRegion="polite" style={{ color: THEME.danger }}>{error}</Text>}
      {message && <Text accessibilityLiveRegion="polite" style={{ color: THEME.textPrimary }}>{message}</Text>}
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={{ color: THEME.textSecondary, marginVertical: 10 }}>Your transaction overrides always win. Lower priority numbers run first. Saving a rule changes future transactions only; existing classifications remain until you preview and apply or reset them.</Text>
        {draft ? <>
          {input("Rule title", "title")}{input("Match text", "matchText")}
          <Text style={{ color: THEME.textSecondary, marginTop: 10 }}>Match field</Text>
          {button(draft.field === "MERCHANT" ? "Merchant name" : "Description", () => setDraft({ ...draft, field: draft.field === "MERCHANT" ? "DESCRIPTION" : "MERCHANT" }))}
          <Text style={{ color: THEME.textSecondary }}>Match mode</Text>
          {(["EXACT", "NORMALIZED_EXACT", "CONTAINS"] as const).map(mode => button(`${draft.matchMode === mode ? "✓ " : ""}${mode === "EXACT" ? "Exact text" : mode === "NORMALIZED_EXACT" ? "Ignore case and punctuation" : "Contains text"}`, () => setDraft({ ...draft, matchMode: mode })))}
          {button(`Direction: ${draft.direction || "any"}`, () => setDraft({ ...draft, direction: draft.direction === null ? "EXPENSE" : draft.direction === "EXPENSE" ? "INCOME" : null }))}
          <Text style={{ color: THEME.textSecondary }}>Account scope (optional)</Text>
          {button(`${!draft.accountId ? "✓ " : ""}All accounts`, () => setDraft({ ...draft, accountId: null }))}
          {accounts.map(a => button(`${draft.accountId === a.id ? "✓ " : ""}${a.label}`, () => setDraft({ ...draft, accountId: a.id })))}
          {input("Provider category condition (optional)", "providerCategoryCondition")}
          {input("Assign category (optional)", "category")}{input("Budget category (optional)", "budgetCategory")}
          <Text style={{ color: THEME.textSecondary }}>Budget assignments resolve to the matching category in each transaction month. Missing monthly budgets are created without a spending limit.</Text>
          {input("Display name (optional)", "displayName")}{input("Priority (0–10000)", "priority", true)}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}><Text style={{ color: THEME.textPrimary, flex: 1 }}>Enabled for future transactions</Text><Switch accessibilityLabel="Rule enabled" value={draft.enabled} disabled={busy} onValueChange={enabled => setDraft({ ...draft, enabled })} /></View>
          {button("Save rule for future transactions", () => void run(async () => {
            if (!draft.title?.trim() || !draft.matchText?.trim()) throw new Error("Enter a title and matching text.");
            if (!Number.isInteger(draft.priority) || draft.priority < 0 || draft.priority > 10000) throw new Error("Priority must be a whole number from 0 to 10000.");
            await rulesAPI.save(draft, editingId); setDraft(null); setEditingId(undefined); await reload(); setMessage("Rule saved. Existing history was not changed.");
          }))}
          {button("Cancel rule edit", () => { setDraft(null); setEditingId(undefined); })}
        </> : <>
          {button("Create rule", () => { setEditingId(undefined); setDraft(empty()); })}
          {button("Refresh rules", () => void run(reload))}
          {!rules.length && !busy && <Text style={{ color: THEME.textSecondary }}>No rules yet.</Text>}
          {rules.map(rule => <View key={rule.id} style={{ padding: 12, marginVertical: 8, borderWidth: 1, borderColor: THEME.border, borderRadius: 12 }}>
            <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>{rule.title} · priority {rule.priority} · {rule.enabled ? "enabled" : "disabled"}</Text>
            <Text style={{ color: THEME.textSecondary }}>{rule.matchText} → {rule.category || "keep category"} / {rule.budgetCategory || "category budget"}</Text>
            {button(`Edit ${rule.title}`, () => { setEditingId(rule.id); setDraft(rule); setPreview(undefined); })}
            {button(`${rule.enabled ? "Disable" : "Enable"} ${rule.title}`, () => void run(async () => { await rulesAPI.save({ ...rule, enabled: !rule.enabled }, rule.id); setPreview(undefined); await reload(); }))}
            {button(`Preview ${rule.title}`, () => void run(async () => { const response = await rulesAPI.preview(rule.id); setPreview({ rule, data: response.data }); }), busy || !rule.enabled)}
            {button(`Delete ${rule.title}`, () => void run(async () => { await rulesAPI.delete(rule); setPreview(undefined); await reload(); setMessage("Rule deleted. Existing classifications remain."); }))}
          </View>)}
          {preview && <View style={{ marginVertical: 15 }}>
            <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>History preview: {preview.data.matches.length} matching transactions</Text>
            <Text style={{ color: THEME.textSecondary }}>Overrides remain protected. Other matching rules may win by priority. If data changes, you must preview again.</Text>
            {preview.data.matches.map(match => <View key={match.id} style={{ paddingVertical: 8 }}>
              <Text style={{ color: THEME.textPrimary }}>{match.name}: {match.category} → {match.proposedCategory} · budget {match.proposedBudgetCategory || "none"}</Text>
              {match.protectedOverride && <Text style={{ color: THEME.warning }}>Explicit choices protected</Text>}
              {match.matchingRules.length > 1 && <Text style={{ color: THEME.warning }}>Multiple matches; winner: {rules.find(r => r.id === match.winnerId)?.title || "another rule"}</Text>}
            </View>)}
            {button("Apply previewed rule to existing history", () => void run(async () => { const result = await dispatch(api.endpoints.applyCategorizationRule.initiate({ id: preview.rule.id, token: preview.data.token })).unwrap(); setPreview(undefined); await reload(); setMessage(`${result.changed} transaction classifications updated.`); }))}
            {button("Dismiss history preview", () => setPreview(undefined))}
          </View>}
          {!!history.length && <Text style={{ color: THEME.textPrimary, fontSize: 18, marginTop: 20 }}>Recent history applications</Text>}
          {history.map(batch => <View key={batch.id} style={{ paddingVertical: 10 }}><Text style={{ color: THEME.textSecondary }}>{new Date(batch.createdAt).toLocaleString()} · {batch.changed} changes{batch.undoneAt ? " · undone" : ""}</Text>
            {!batch.undoneAt && button(`Undo application ${batch.id.slice(0, 8)}`, () => void run(async () => { const result = await dispatch(api.endpoints.undoCategorizationRule.initiate(batch.id)).unwrap(); await reload(); setMessage(`${result.changed} classifications restored. Financial source data was preserved.`); }))}
          </View>)}
        </>}
      </ScrollView>
    </View>
  </Modal>;
}
