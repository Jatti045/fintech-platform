import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BackHandler, Text, TextInput, TouchableOpacity } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import FundleafSheet from "@/components/sheets/FundleafSheet";
import { useSheetDismiss } from "@/components/sheets/useSheetDismiss";
import { AlertProvider } from "@/utils/themedAlert";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import BrandInput from "@/components/brand/BrandInput";

function mount(element: React.ReactElement, theme = "Light") {
  const store = configureStore({ reducer: { theme: themeReducer } });
  store.dispatch(setTheme(theme));
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>{element}</AlertProvider>
      </Provider>,
    );
  });
  return tree;
}
const button = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === label)!;
afterEach(() => jest.clearAllMocks());
it.each(["Light", "Dark"])(
  "%s uses shared handle, keyboard, sizing and backdrop configuration",
  (appearance) => {
    const close = jest.fn();
    const tree = mount(
      <FundleafSheet visible onDismiss={close} title="Test sheet">
        <BrandInput label="Example" />
      </FundleafSheet>,
      appearance,
    );
    const props = tree.root.findByType(BottomSheetModal).props;
    const theme =
      appearance === "Light" ? THEME_PALETTES.LIGHT : THEME_PALETTES.DARK;
    expect(props.backgroundStyle.backgroundColor).toBe(theme.surface);
    expect(props.enablePanDownToClose).toBe(true);
    expect(props.enableDynamicSizing).toBe(true);
    expect(props.keyboardBehavior).toBe("interactive");
    expect(props.android_keyboardInputMode).toBe("adjustResize");
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(button(tree, "Dismiss Test sheet")).toBeTruthy();
    act(() => button(tree, "Dismiss Test sheet backdrop").props.onPress());
    expect(close).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  },
);
it("completed swipe dismissal calls the owner and removes its Back subscription on unmount", () => {
  const close = jest.fn();
  const tree = mount(
    <FundleafSheet visible onDismiss={close} title="Swipe">
      <Text>Contents</Text>
    </FundleafSheet>,
  );
  act(() => tree.root.findByType(BottomSheetModal).props.onDismiss());
  expect(close).toHaveBeenCalledTimes(1);
  const subscription = (
    BackHandler.addEventListener as jest.Mock
  ).mock.results.at(-1)!.value;
  act(() => tree.unmount());
  expect(subscription.remove).toHaveBeenCalled();
});
it("only the topmost sheet consumes Android Back", () => {
  const parent = jest.fn(),
    child = jest.fn();
  const tree = mount(
    <>
      <FundleafSheet visible onDismiss={parent} title="Parent">
        Content
      </FundleafSheet>
      <FundleafSheet visible onDismiss={child} title="Child">
        Content
      </FundleafSheet>
    </>,
  );
  const calls = (BackHandler.addEventListener as jest.Mock).mock.calls;
  act(() => {
    expect(calls[calls.length - 2][1]()).toBe(false);
    expect(calls[calls.length - 1][1]()).toBe(true);
  });
  expect(parent).not.toHaveBeenCalled();
  expect(child).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it("busy sheets block swipe, backdrop, handle and Back dismissal", () => {
  const close = jest.fn();
  const tree = mount(
    <FundleafSheet visible busy onDismiss={close} title="Saving">
      Content
    </FundleafSheet>,
  );
  expect(
    tree.root.findByType(BottomSheetModal).props.enablePanDownToClose,
  ).toBe(false);
  act(() => {
    button(tree, "Dismiss Saving").props.onPress();
    button(tree, "Dismiss Saving backdrop").props.onPress();
    (BackHandler.addEventListener as jest.Mock).mock.calls.at(-1)![1]();
  });
  expect(close).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it("backdrop dismissal is optional", () => {
  const close = jest.fn();
  const tree = mount(
    <FundleafSheet
      visible
      backdropDismiss={false}
      onDismiss={close}
      title="Choice"
    >
      Content
    </FundleafSheet>,
  );
  expect(button(tree, "Dismiss Choice backdrop")).toBeUndefined();
  act(() => tree.unmount());
});
it("dirty drafts survive dismissal until explicitly discarded", () => {
  const close = jest.fn();
  function Form() {
    const dismiss = useSheetDismiss(close, true, false);
    return (
      <FundleafSheet visible dirty onDismiss={dismiss} title="Draft">
        <Text>Unsaved draft</Text>
      </FundleafSheet>
    );
  }
  const tree = mount(<Form />);
  expect(
    tree.root.findByType(BottomSheetModal).props.enablePanDownToClose,
  ).toBe(false);
  act(() => button(tree, "Dismiss Draft").props.onPress());
  expect(close).not.toHaveBeenCalled();
  act(() => button(tree, "Keep editing").props.onPress());
  expect(close).not.toHaveBeenCalled();
  act(() => button(tree, "Dismiss Draft backdrop").props.onPress());
  act(() => button(tree, "Discard changes").props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it("does not dismiss a never-presented modal and presents only once per opening", () => {
  const { sheetLifecycle } = require("@gorhom/bottom-sheet");
  let open!: React.Dispatch<React.SetStateAction<boolean>>;
  let rerender!: React.Dispatch<React.SetStateAction<number>>;
  function Harness() {
    const [visible, setVisible] = React.useState(false);
    const [count, setCount] = React.useState(0);
    open = setVisible;
    rerender = setCount;
    return (
      <FundleafSheet
        visible={visible}
        title="Lifecycle"
        onDismiss={() => setVisible(false)}
      >
        {count}
      </FundleafSheet>
    );
  }
  const tree = mount(<Harness />);
  expect(sheetLifecycle.dismiss).not.toHaveBeenCalled();
  act(() => open(true));
  expect(sheetLifecycle.present).toHaveBeenCalledTimes(1);
  act(() => rerender(1));
  expect(sheetLifecycle.present).toHaveBeenCalledTimes(1);
  act(() => open(false));
  expect(sheetLifecycle.dismiss).toHaveBeenCalledTimes(1);
  act(() => open(true));
  expect(sheetLifecycle.present).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});

it("ignores a late animation callback after unmount", () => {
  const close = jest.fn();
  const tree = mount(<FundleafSheet visible onDismiss={close} title="Leaving">Content</FundleafSheet>);
  const callback = tree.root.findByType(BottomSheetModal).props.onDismiss;
  act(() => tree.unmount());
  act(() => callback());
  expect(close).not.toHaveBeenCalled();
});
