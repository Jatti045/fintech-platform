import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { TouchableOpacity } from "react-native";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import PlaidStatusBanner from "@/components/plaid/PlaidStatusBanner";
import { THEME_PALETTES, sheetSurface } from "@/constants/ThemePalettes";
import { FLOATING_TAB_BAR, getFloatingTabBarHeight } from "@/constants/appConfig";

const openReauth = jest.fn(), retrySync = jest.fn();
let health: any;
jest.mock("@/hooks/plaid/usePlaidHealth", () => ({ usePlaidHealth: () => health }));
jest.mock("@/store/slices/plaidSlice", () => ({ fetchPlaidItems: () => ({ type: "test/refreshBanks" }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 4, right: 4 }) }));
const bank = { id: "test-bank", institutionName: "Test Bank", status: "REQUIRES_REAUTH" } as any;
function mount(appearance = "Light") {
  const store = configureStore({ reducer: { theme: themeReducer } });
  store.dispatch(setTheme(appearance));
  const height = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Provider store={store}><PlaidStatusBanner onHeightChange={height} /></Provider>); });
  return { tree, height };
}
beforeEach(() => {
  jest.clearAllMocks();
  health = { reauthItems: [], retryableItems: [], reauthingItemId: null, syncingItemIds: [], openReauth, retrySync };
});
it("does not show a reconnect notification for healthy connections", () => {
  const { tree, height } = mount();
  expect(tree.toJSON()).toBeNull();
  expect(height).toHaveBeenCalledWith(0);
  act(() => tree.unmount());
});
it.each(["Light", "Dark"])("uses an opaque %s surface above the safe area and dock, reserves its height, and reconnects the right bank", (appearance) => {
  health.reauthItems = [bank];
  const { tree, height } = mount(appearance);
  const card = tree.root.findByType(TouchableOpacity);
  const theme = appearance === "Light" ? THEME_PALETTES.LIGHT : THEME_PALETTES.DARK;
  expect(card.props.style.backgroundColor).toBe(sheetSurface(theme));
  expect(card.props.style.borderColor).toBe(theme.warning);
  expect(card.props.accessibilityLabel).toBe("Reconnect Test Bank");
  const wrapper = tree.root.findAll((n) => n.type === ("View" as any) && n.props.testID === "bank-attention-notification")[0];
  expect(wrapper.props.style.bottom).toBe(getFloatingTabBarHeight() + FLOATING_TAB_BAR.gap * 2 + 34);
  act(() => wrapper.props.onLayout({ nativeEvent: { layout: { height: 140 } } }));
  expect(height).toHaveBeenCalledWith(140);
  act(() => card.props.onPress());
  expect(openReauth).toHaveBeenCalledWith(bank);
  act(() => tree.unmount());
});
it("offers refresh instead of reconnect for sync failures", () => {
  health.retryableItems = [{ ...bank, status: "ACTIVE", syncStatus: "FAILED" }];
  const { tree } = mount();
  const card = tree.root.findByType(TouchableOpacity);
  expect(card.props.accessibilityLabel).toBe("Refresh sync for Test Bank");
  act(() => card.props.onPress());
  expect(retrySync).toHaveBeenCalledWith(health.retryableItems[0]);
  expect(openReauth).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it("disables the action while reconnecting", () => {
  health.reauthItems = [bank]; health.reauthingItemId = bank.id;
  const { tree } = mount();
  expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(true);
  act(() => tree.unmount());
});
