import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { TouchableOpacity, TextInput, Text } from "react-native";
import RulesManager from "@/components/rules/RulesManager";
import rulesAPI from "@/api/categorizationRules";
import api from "@/store/api/apiSlice";
import theme from "@/store/slices/themeSlice";
import insight from "@/api/insight";

jest.mock("@/api/categorizationRules", () => ({ __esModule: true, default: {
  list: jest.fn(), history: jest.fn(), accounts: jest.fn(), save: jest.fn(), delete: jest.fn(), preview: jest.fn(), apply: jest.fn(), undo: jest.fn(), reset: jest.fn(),
} }));
jest.mock("@/api/insight", () => ({ __esModule: true, default: { fetchMonthlyInsight: jest.fn() } }));
const rule = { id: "rule", title: "Coffee", field: "MERCHANT", matchMode: "NORMALIZED_EXACT", matchText: "Starbucks", category: "Coffee", budgetCategory: "Food", displayName: null, direction: null, accountId: null, providerCategoryCondition: null, priority: 1, enabled: true, revision: 2, createdAt: "2026-10-12T00:00:00Z" };
const mocked = rulesAPI as unknown as Record<string, jest.Mock>;
const buttons = TouchableOpacity as unknown as jest.Mock;
const inputs = TextInput as unknown as jest.Mock;
let tree: renderer.ReactTestRenderer;
let store: ReturnType<typeof createStore>;
function createStore() { return configureStore({ reducer: { theme, [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) }); }
function props(mock: jest.Mock, label: string) { return [...mock.mock.calls].reverse().find(c => c[0]?.accessibilityLabel === label)?.[0]; }
async function press(label: string) { await renderer.act(async () => { props(buttons, label).onPress(); await new Promise(r => setTimeout(r, 0)); }); }
beforeEach(async () => {
  jest.clearAllMocks(); mocked.list.mockResolvedValue({data:[rule]}); mocked.history.mockResolvedValue({data:[]}); mocked.accounts.mockResolvedValue({data:[]}); mocked.save.mockResolvedValue({data:rule});
  store=createStore(); await renderer.act(async () => { tree=renderer.create(<Provider store={store}><RulesManager visible onClose={jest.fn()} /></Provider>); });
});
afterEach(async () => { await renderer.act(async () => tree.unmount()); store.dispatch(api.util.resetApiState()); });
test("saving an edited rule keeps its revision and is future-only", async () => {
  await press("Edit Coffee"); await renderer.act(async () => props(inputs,"Assign category (optional)").onChangeText("Drinks"));
  await press("Save rule for future transactions"); expect(mocked.save).toHaveBeenCalledWith(expect.objectContaining({category:"Drinks", revision:2}),"rule"); expect(mocked.apply).not.toHaveBeenCalled();
});
test("historical application requires preview and sends its token through the financial mutation", async () => {
  mocked.preview.mockResolvedValue({data:{token:"verified-preview", matches:[{id:"tx", name:"Starbucks", category:"Food", proposedCategory:"Coffee", proposedBudgetCategory:"Food", protectedOverride:true, matchingRules:["rule","other"], winnerId:"rule"}], truncated:false}});
  mocked.apply.mockResolvedValue({data:{applicationId:"batch",changed:1}}); await press("Preview Coffee"); expect(mocked.apply).not.toHaveBeenCalled();
  await press("Apply previewed rule to existing history"); expect(mocked.apply).toHaveBeenCalledWith("rule","verified-preview");
  expect(Object.values(store.getState().api.mutations).some(m => m?.endpointName === "applyCategorizationRule" && m.status === "fulfilled")).toBe(true);
  expect(insight.fetchMonthlyInsight).not.toHaveBeenCalled();
});
test("disabled and deleted rules use revision protection", async () => {
  await press("Disable Coffee"); expect(mocked.save).toHaveBeenCalledWith(expect.objectContaining({enabled:false, revision:2}),"rule");
  mocked.delete.mockResolvedValue({}); await press("Delete Coffee"); expect(mocked.delete).toHaveBeenCalledWith(rule); expect(mocked.apply).not.toHaveBeenCalled();
});
test("preview conflicts are visible and do not claim successful history changes", async () => {
  mocked.preview.mockResolvedValue({data:{token:"stale",matches:[],truncated:false}}); mocked.apply.mockRejectedValue(new Error("History changed. Preview again"));
  await press("Preview Coffee"); await press("Apply previewed rule to existing history");
  expect((Text as unknown as jest.Mock).mock.calls.some(c => String(c[0].children).includes("History changed. Preview again"))).toBe(true);
});
test("persisted application can be undone after opening the manager again", async () => {
  mocked.history.mockResolvedValue({data:[{id:"batch-id",ruleId:"rule",createdAt:"2026-10-12T00:00:00Z",undoneAt:null,changed:1}]}); mocked.undo.mockResolvedValue({data:{applicationId:"batch-id",changed:1}});
  await press("Refresh rules"); await press("Undo application batch-id"); expect(mocked.undo).toHaveBeenCalledWith("batch-id"); expect(insight.fetchMonthlyInsight).not.toHaveBeenCalled();
});
