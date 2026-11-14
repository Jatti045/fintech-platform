import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { Alert, Animated, PanResponder, TouchableOpacity } from "react-native";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import PlaidStatusBanner from "@/components/plaid/PlaidStatusBanner";

const openReauth = jest.fn(), retrySync = jest.fn();
let health: any;
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  return {
    ...native,
    Alert: { alert: () => {} },
    Easing: { bezier: () => undefined },
    Animated: {
      ...native.Animated,
      Text: native.Text,
      Value: class {
        interpolate() { return 0; }
      },
      timing: () => ({ start() {}, stop() {} }),
      ValueXY: class {
        setValue() {}
        getTranslateTransform() { return []; }
      },
    },
    PanResponder: { create: () => ({ panHandlers: {} }) },
  };
});
jest.mock("@/hooks/plaid/usePlaidHealth", () => ({ usePlaidHealth: () => health }));
jest.mock("@/store/slices/plaidSlice", () => ({ fetchPlaidItems: () => ({ type: "test/refreshBanks" }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 4, right: 4 }) }));
const bank = { id: "test-bank", institutionName: "Test Bank", status: "REQUIRES_REAUTH" } as any;
function mount(appearance = "Light", preview = false) {
  const store = configureStore({ reducer: { theme: themeReducer } });
  store.dispatch(setTheme(appearance));
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Provider store={store}><PlaidStatusBanner preview={preview} /></Provider>); });
  return tree;
}
function button(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === label)!;
}
function toggleAlert(tree: renderer.ReactTestRenderer) {
  act(() => button(tree, "Bank connection alerts").props.onPress());
}
beforeEach(() => {
  jest.clearAllMocks();
  health = { reauthItems: [], retryableItems: [], reauthingItemId: null, syncingItemIds: [], openReauth, retrySync };
});
it("does not show a reconnect notification for healthy connections", () => {
  const tree = mount();
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});
it.each(["Light", "Dark"])("opens and closes the alert in %s mode and reconnects the right bank", (appearance) => {
  health.reauthItems = [bank];
  const tree = mount(appearance);
  const alert = button(tree, "Bank connection alerts");
  expect(alert.props.accessibilityState.expanded).toBe(false);
  toggleAlert(tree);
  expect(alert.props.accessibilityState.expanded).toBe(true);
  act(() => button(tree, "Reconnect Test Bank").props.onPress());
  expect(openReauth).toHaveBeenCalledWith(bank);
  toggleAlert(tree);
  expect(alert.props.accessibilityState.expanded).toBe(false);
  act(() => tree.unmount());
});
it("shows the demo alert without attempting a real reconnection", () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const tree = mount("Light", true);
  toggleAlert(tree);
  act(() => button(tree, "Reconnect Demo Bank").props.onPress());
  expect(alert).toHaveBeenCalled();
  expect(openReauth).not.toHaveBeenCalled();
  alert.mockRestore();
  act(() => tree.unmount());
});
it("snaps to each corner after dragging", () => {
  const responder = jest.spyOn(PanResponder, "create");
  const tree = mount("Light", true);
  const overlay = tree.root.findAllByProps({ testID: "bank-attention-notification" })[0];
  act(() => overlay.props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }));
  const handle = tree.root.findAllByType(Animated.View)[0];
  const position = () => Object.assign({}, ...handle.props.style);
  const { top: bottom, right } = position();
  const release = (dx: number, dy: number) => {
    const config = responder.mock.calls[responder.mock.calls.length - 1][0];
    act(() => config.onPanResponderRelease?.({} as never, { dx, dy } as never));
  };
  release(-400, -800);
  expect(position()).toMatchObject({ left: 16, top: 56 });
  release(400, 0);
  expect(position()).toMatchObject({ right, top: 56 });
  release(-400, 800);
  expect(position()).toMatchObject({ left: 16, top: bottom });
  release(400, 0);
  expect(position()).toMatchObject({ right, top: bottom });
  responder.mockRestore();
  act(() => tree.unmount());
});
it("offers refresh instead of reconnect for sync failures", () => {
  health.retryableItems = [{ ...bank, status: "ACTIVE", syncStatus: "FAILED" }];
  const tree = mount();
  toggleAlert(tree);
  const card = button(tree, "Refresh sync for Test Bank");
  expect(card.props.accessibilityLabel).toBe("Refresh sync for Test Bank");
  act(() => card.props.onPress());
  expect(retrySync).toHaveBeenCalledWith(health.retryableItems[0]);
  expect(openReauth).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it("disables the action while reconnecting", () => {
  health.reauthItems = [bank]; health.reauthingItemId = bank.id;
  const tree = mount();
  toggleAlert(tree);
  expect(button(tree, "Reconnect Test Bank").props.disabled).toBe(true);
  act(() => tree.unmount());
});
