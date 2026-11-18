import React from "react";
import renderer, { act } from "react-test-renderer";
import { TextInput, TouchableOpacity } from "react-native";
import { Provider } from "react-redux";
import { getLocales } from "expo-localization";
import AccountSetupRoute from "@/app/account-setup";
import { userAPI } from "@/api/user";
import { store } from "@/store/store";
import { loginUser, resetUserState } from "@/store/slices/userSlice";
import type { IUser } from "@/types/user/types";

jest.mock("expo-localization", () => ({ getLocales: jest.fn(), getCalendars: () => [] }));
jest.mock("@/components/sheets/FundleafSheet", () => ({
  __esModule: true,
  SheetInputContext: jest.requireActual<typeof React>("react").createContext(false),
  default: ({ children, visible }: React.PropsWithChildren<{ visible: boolean }>) => visible ? children : null,
}));

const account: IUser = {
  id: "new-user",
  email: "setup@example.com",
  username: "New User",
  setupComplete: false,
};

function signIn(user = account) {
  store.dispatch(loginUser.fulfilled(
    { user, token: "setup-token" }, "login", { email: user.email, password: "test-password" },
  ));
}

function renderSetup() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    signIn();
    tree = renderer.create(<Provider store={store}><AccountSetupRoute /></Provider>);
  });
  return tree;
}

function press(tree: renderer.ReactTestRenderer, label: string) {
  const control = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.props.accessibilityLabel === label || node.findAllByProps({ children: label }).length > 0,
  );
  expect(control).toBeDefined();
  return control!.props.onPress();
}

function enter(tree: renderer.ReactTestRenderer, value: string) {
  act(() => tree.root.findByType(TextInput).props.onChangeText(value));
}

const mockLocale = jest.mocked(getLocales);
const saveSetup = jest.spyOn(userAPI, "completeAccountSetup");

beforeEach(() => {
  mockLocale.mockReturnValue([]);
  saveSetup.mockReset();
  store.dispatch(resetUserState());
});

afterAll(() => saveSetup.mockRestore());

it.each(["", "-5", "invalid", "3,500", "1e3"])("rejects an invalid or missing income (%s)", (amount) => {
  const tree = renderSetup();
  enter(tree, amount);
  act(() => { press(tree, "Continue"); });
  expect(JSON.stringify(tree.toJSON())).toContain("Enter a monthly amount of zero or more.");
  expect(tree.root.findByType(TextInput).props.keyboardType).toBe("decimal-pad");
  expect(saveSetup).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it("requires an explicit currency choice and accepts zero after going back", async () => {
  const tree = renderSetup();
  enter(tree, "0");
  act(() => { press(tree, "Continue"); });
  act(() => { press(tree, "Finish setup"); });
  expect(JSON.stringify(tree.toJSON())).toContain("Choose your default currency.");
  expect(saveSetup).not.toHaveBeenCalled();
  act(() => { press(tree, "Choose currency"); });
  act(() => { press(tree, "CAD — Canadian Dollar"); });
  act(() => { press(tree, "Back"); });
  expect(tree.root.findByType(TextInput).props.value).toBe("0");
  act(() => { press(tree, "Continue"); });
  saveSetup.mockResolvedValueOnce({ ...account, setupComplete: true, currency: "CAD", monthlyIncome: 0 });
  await act(async () => { press(tree, "Finish setup"); });

  expect(saveSetup).toHaveBeenCalledWith({ monthlyIncome: 0, currency: "CAD" }, expect.any(Number));
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});

it("keeps both entries after a failed save, blocks duplicates, and allows a successful retry", async () => {
  mockLocale.mockReturnValue([{ currencyCode: "CAD", decimalSeparator: "," } as ReturnType<typeof getLocales>[number]]);
  let rejectSave!: (error: Error) => void;
  saveSetup.mockReturnValueOnce(new Promise((_, reject) => { rejectSave = reject; }));
  const tree = renderSetup();
  enter(tree, "3500,75");
  act(() => { press(tree, "Continue"); });
  expect(JSON.stringify(tree.toJSON())).toContain("Suggested from your device settings");
  expect(JSON.stringify(tree.toJSON())).toContain("CAD — Canadian Dollar");

  act(() => {
    press(tree, "Finish setup");
    press(tree, "Finish setup");
  });
  expect(saveSetup).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).toContain("Saving…");

  await act(async () => { rejectSave(new Error("Connection lost. Please try again.")); });
  expect(JSON.stringify(tree.toJSON())).toContain("Connection lost. Please try again.");
  expect(JSON.stringify(tree.toJSON())).toContain("3500,75");
  expect(JSON.stringify(tree.toJSON())).toContain("CAD — Canadian Dollar");
  expect(store.getState().user.user?.setupComplete).toBe(false);

  saveSetup.mockResolvedValueOnce({ ...account, setupComplete: true, currency: "CAD", monthlyIncome: 3500.75 });
  await act(async () => { press(tree, "Finish setup"); });
  expect(saveSetup).toHaveBeenNthCalledWith(2, { monthlyIncome: 3500.75, currency: "CAD" }, expect.any(Number));
  expect(store.getState().user.user?.monthlyIncome).toBe(3500.75);
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});

it("starts a fresh form when an unfinished account signs out or switches users", () => {
  const tree = renderSetup();
  enter(tree, "123");
  act(() => { press(tree, "Continue"); });
  act(() => { store.dispatch(resetUserState()); });
  expect(tree.toJSON()).toBeNull();

  act(() => { signIn({ ...account, id: "another-user" }); });
  expect(tree.root.findByType(TextInput).props.value).toBe("");
  act(() => { signIn(); });
  expect(tree.root.findByType(TextInput).props.value).toBe("");
  act(() => tree.unmount());
});
