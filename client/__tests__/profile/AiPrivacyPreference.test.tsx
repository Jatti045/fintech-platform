import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import themeReducer from "@/store/slices/themeSlice";
import AiPrivacyPreference from "@/components/privacy/AiPrivacyPreference";

const preference = { enabled: true, disclosureVersion: "1", providerName: "Test provider" };
const update = jest.fn(() => ({ unwrap: async () => ({}) }));
jest.mock("@/store/api/apiSlice", () => ({
  useGetAiPrivacyQuery: () => ({ data: preference, isLoading: false }),
  useUpdateAiPrivacyMutation: () => [update, { isLoading: false }],
}));
const store = configureStore({ reducer: { theme: themeReducer } });
beforeEach(() => { update.mockClear(); preference.enabled = true; });
function mount() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Provider store={store}><AiPrivacyPreference /></Provider>); });
  return tree;
}
test("settings load never changes consent; opting out persists disabled", async () => {
  const tree = mount();
  expect(update).not.toHaveBeenCalled();
  const toggle = tree.root.findAll(node => node.props.accessibilityLabel === "Allow external AI explanations")[0];
  await act(async () => { toggle.props.onValueChange(false); });
  expect(update).toHaveBeenCalledWith({ enabled: false, disclosureVersion: undefined });
  tree.unmount();
});
test("turning the switch on requires disclosure acceptance", () => {
  preference.enabled = false;
  const tree = mount();
  act(() => { tree.root.findAll(node => node.props.accessibilityLabel === "Allow external AI explanations")[0].props.onValueChange(true); });
  expect(update).not.toHaveBeenCalled();
  act(() => { tree.root.findAll(node => node.props.accessibilityLabel === "Keep AI disabled")[0].props.onPress(); });
  expect(update).not.toHaveBeenCalled();
  tree.unmount();
});
