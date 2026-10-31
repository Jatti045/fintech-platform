import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { TextInput, TouchableOpacity, Switch } from "react-native";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ThemeSwitcher from "@/components/profile/ThemeSwitcher";
import ChangePasswordModal from "@/components/profile/ChangePasswordModal";
import NotificationsCard from "@/components/profile/NotificationsCard";
import MonthlyIncome from "@/components/profile/MonthlyIncome";
import BankConnections from "@/components/profile/BankConnections";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const reconnect = jest.fn(),
  retrySync = jest.fn();
jest.mock("@/hooks/plaid/usePlaidHealth", () => ({
  usePlaidHealth: () => ({
    reauthingItemId: null,
    syncingItemIds: [],
    openReauth: reconnect,
    retrySync,
  }),
}));
function mount(element: React.ReactElement, appearance = "Light") {
  const store = configureStore({ reducer: { theme: themeReducer } });
  store.dispatch(setTheme(appearance));
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Provider store={store}>{element}</Provider>);
  });
  return tree;
}
const button = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === label)!;
const theme = THEME_PALETTES.LIGHT;
afterEach(() => jest.clearAllMocks());
it.each(["Light", "Dark"])(
  "%s never displays fabricated personal information",
  (appearance) => {
    const tree = mount(
      <ProfileHeader
        THEME={theme}
        user={null}
        uploading={false}
        deleting={false}
        onPickImage={jest.fn()}
        onDeleteImage={jest.fn()}
      />,
      appearance,
    );
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain("Your account");
    expect(text).toContain("FL");
    expect(text).not.toContain("james.attia@gmail.com");
    expect(text).toContain("Fundleaf member");
    act(() => tree.unmount());
  },
);
it("offers System and retains all legacy appearance choices", () => {
  const select = jest.fn();
  const tree = mount(
    <ThemeSwitcher
      THEME={theme}
      selectedTheme="System"
      onThemeSelect={select}
    />,
  );
  expect(button(tree, "System theme").props.accessibilityState.selected).toBe(
    true,
  );
  for (const name of ["Light", "Dark", "System", "Ember", "Aurora"])
    act(() => button(tree, `${name} theme`).props.onPress());
  expect(select.mock.calls.map((c) => c[0])).toEqual([
    "Light",
    "Dark",
    "System",
    "Ember",
    "Aurora",
  ]);
  act(() => tree.unmount());
});
it("password form preserves exact input, allows visibility toggles, and blocks actions while saving", async () => {
  const submit = jest.fn().mockResolvedValue(undefined),
    close = jest.fn();
  const tree = mount(
    <ChangePasswordModal
      THEME={theme}
      visible
      onClose={close}
      onSubmit={submit}
      saving={false}
    />,
  );
  const inputs = tree.root.findAllByType(TextInput);
  act(() =>
    inputs.forEach((input, i) =>
      input.props.onChangeText(["old secret", "new secret", "new secret"][i]),
    ),
  );
  act(() => button(tree, "Show current password").props.onPress());
  expect(tree.root.findAllByType(TextInput)[0].props.secureTextEntry).toBe(
    false,
  );
  const save = tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === "Update Password")!;
  await act(async () => save.props.onPress());
  expect(submit).toHaveBeenCalledWith("old secret", "new secret", "new secret");
  act(() => button(tree, "Cancel password change").props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAllByType(TextInput).every((n) => n.props.value === ""),
  ).toBe(true);
  act(() => tree.unmount());
  const busy = mount(
    <ChangePasswordModal
      THEME={theme}
      visible
      onClose={close}
      onSubmit={submit}
      saving
    />,
  );
  expect(button(busy, "Cancel password change").props.disabled).toBe(true);
  expect(
    busy.root.findAllByType(TextInput).every((n) => n.props.editable === false),
  ).toBe(true);
  act(() => button(busy, "Cancel password change").props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
  act(() => busy.unmount());
});
it("notification switches show effective denied state and expose device settings", () => {
  const open = jest.fn();
  const tree = mount(
    <NotificationsCard
      purchaseRemindersEnabled
      billRemindersEnabled
      notificationPermissionDenied
      onTogglePurchaseReminders={jest.fn()}
      onToggleBillReminders={jest.fn()}
      onOpenSettings={open}
    />,
  );
  for (const toggle of tree.root.findAllByType(Switch)) {
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.accessibilityLabel).toBeTruthy();
  }
  act(() => button(tree, "Open Settings").props.onPress());
  expect(open).toHaveBeenCalled();
  act(() => tree.unmount());
});
it("income states identify the selected month and retain the original save callback", () => {
  const save = jest.fn();
  const tree = mount(
    <MonthlyIncome
      THEME={theme}
      monthLabel="2026-02"
      input="1000"
      setInput={jest.fn()}
      saving={false}
      onSave={save}
      actualIncome={null}
      error
    />,
  );
  expect(JSON.stringify(tree.toJSON())).toContain("2026-02");
  expect(JSON.stringify(tree.toJSON())).toContain(
    "Recorded income unavailable",
  );
  act(() => button(tree, "Save Monthly Income").props.onPress());
  expect(save).toHaveBeenCalled();
  act(() => tree.unmount());
});
it("bank status and reconnect, refresh, disconnect and link actions retain their item", () => {
  const link = jest.fn(),
    disconnect = jest.fn();
  const item = {
    id: "bank-test",
    institutionName: "Test institution with a long name",
    createdAt: "2026-02-01T12:00:00Z",
    status: "REQUIRES_REAUTH",
    syncStatus: "FAILED",
    syncError: "Unavailable",
  } as any;
  const tree = mount(
    <BankConnections
      THEME={theme}
      linking={false}
      onLinkBank={link}
      items={[item]}
      loadingItems={false}
      disconnectingId={null}
      onDisconnect={disconnect}
    />,
  );
  expect(JSON.stringify(tree.toJSON())).toContain("Reconnect required");
  act(() => button(tree, `Reconnect ${item.institutionName}`).props.onPress());
  expect(reconnect).toHaveBeenCalledWith(item);
  act(() =>
    button(tree, `Refresh sync for ${item.institutionName}`).props.onPress(),
  );
  expect(retrySync).toHaveBeenCalledWith(item);
  act(() => button(tree, `Disconnect ${item.institutionName}`).props.onPress());
  expect(disconnect).toHaveBeenCalledWith(item);
  act(() => button(tree, "Connect a bank account").props.onPress());
  expect(link).toHaveBeenCalled();
  act(() => tree.unmount());
});

it("failed bank loading offers retry without claiming no banks are connected", () => {
  const retry = jest.fn();
  const tree = mount(
    <BankConnections
      THEME={theme}
      linking={false}
      onLinkBank={jest.fn()}
      items={[]}
      loadingItems={false}
      itemsError
      onRetry={retry}
      disconnectingId={null}
      onDisconnect={jest.fn()}
    />,
  );
  expect(JSON.stringify(tree.toJSON())).toContain(
    "Could not refresh bank connections",
  );
  expect(JSON.stringify(tree.toJSON())).not.toContain("No banks connected yet");
  act(() => button(tree, "Retry bank connections").props.onPress());
  expect(retry).toHaveBeenCalled();
  act(() => tree.unmount());
});
