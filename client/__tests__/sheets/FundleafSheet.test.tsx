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
afterEach(() => {
  jest.clearAllMocks();
  require("@gorhom/bottom-sheet").sheetLifecycle.deferDismiss = false;
  require("@gorhom/bottom-sheet").sheetLifecycle.deferPresent = false;
});
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
  const tree = mount(
    <FundleafSheet visible onDismiss={close} title="Leaving">
      Content
    </FundleafSheet>,
  );
  const callback = tree.root.findByType(BottomSheetModal).props.onDismiss;
  act(() => tree.unmount());
  act(() => callback());
  expect(close).not.toHaveBeenCalled();
});

it.each([
  "swipe",
  "backdrop",
  "back",
  "cancel",
  "save",
  "selection",
  "programmatic",
])(
  "reopens repeatedly after %s and synchronizes the owner exactly once",
  (method) => {
    const { sheetInstances, sheetLifecycle } = require("@gorhom/bottom-sheet");
    sheetLifecycle.deferDismiss = false;
    const dismissed = jest.fn();
    function Harness() {
      const [visible, setVisible] = React.useState(false);
      return (
        <>
          <TouchableOpacity
            accessibilityLabel="Open cycle"
            onPress={() => setVisible(true)}
          />
          <TouchableOpacity
            accessibilityLabel="Programmatic close"
            onPress={() => setVisible(false)}
          />
          <FundleafSheet
            visible={visible}
            title="Cycle"
            onDismiss={() => {
              dismissed();
              setVisible(false);
            }}
          >
            <TouchableOpacity
              accessibilityLabel="Cancel cycle"
              onPress={() => setVisible(false)}
            />
          </FundleafSheet>
        </>
      );
    }
    const tree = mount(<Harness />);
    for (let i = 0; i < 5; i++) {
      act(() => button(tree, "Open cycle").props.onPress());
      expect(button(tree, "Dismiss Cycle")).toBeTruthy();
      act(() => {
        if (method === "swipe") sheetInstances.get("Cycle").swipe();
        else if (method === "backdrop")
          button(tree, "Dismiss Cycle backdrop").props.onPress();
        else if (method === "back")
          (BackHandler.addEventListener as jest.Mock).mock.calls.at(-1)![1]();
        else if (method === "cancel")
          button(tree, "Cancel cycle").props.onPress();
        else button(tree, "Programmatic close").props.onPress();
      });
      expect(button(tree, "Dismiss Cycle")).toBeUndefined();
      expect(dismissed).toHaveBeenCalledTimes(
        ["swipe", "backdrop", "back"].includes(method) ? i + 1 : 0,
      );
    }
    act(() => tree.unmount());
  },
);

it("queues rapid reopening until the previous close completes", () => {
  const { sheetInstances, sheetLifecycle } = require("@gorhom/bottom-sheet");
  sheetLifecycle.deferDismiss = true;
  const dismissed = jest.fn();
  let setVisible!: React.Dispatch<React.SetStateAction<boolean>>;
  function Harness() {
    const [visible, update] = React.useState(true);
    setVisible = update;
    return (
      <FundleafSheet
        visible={visible}
        title="Rapid"
        onDismiss={() => {
          dismissed();
          update(false);
        }}
      >
        Content
      </FundleafSheet>
    );
  }
  const tree = mount(<Harness />);
  act(() => setVisible(false));
  act(() => setVisible(true));
  expect(sheetLifecycle.present).toHaveBeenCalledTimes(1);
  act(() => sheetInstances.get("Rapid").completeClose());
  expect(sheetLifecycle.present).toHaveBeenCalledTimes(2);
  expect(button(tree, "Dismiss Rapid")).toBeTruthy();
  expect(dismissed).not.toHaveBeenCalled();
  sheetLifecycle.deferDismiss = false;
  act(() => sheetInstances.get("Rapid").swipe());
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(button(tree, "Dismiss Rapid")).toBeUndefined();
  act(() => tree.unmount());
});

it("can close and reopen a nested sheet while its parent stays usable", () => {
  const { sheetInstances } = require("@gorhom/bottom-sheet");
  function Harness() {
    const [child, setChild] = React.useState(false);
    return (
      <FundleafSheet visible title="Outer" onDismiss={jest.fn()}>
        <TouchableOpacity
          accessibilityLabel="Open inner"
          onPress={() => setChild(true)}
        />
        <FundleafSheet
          visible={child}
          title="Inner"
          onDismiss={() => setChild(false)}
        >
          Inner content
        </FundleafSheet>
      </FundleafSheet>
    );
  }
  const tree = mount(<Harness />);
  for (let i = 0; i < 3; i++) {
    act(() => button(tree, "Open inner").props.onPress());
    expect(button(tree, "Dismiss Inner")).toBeTruthy();
    act(() => sheetInstances.get("Inner").swipe());
    expect(button(tree, "Dismiss Inner")).toBeUndefined();
    expect(button(tree, "Dismiss Outer")).toBeTruthy();
  }
  act(() => tree.unmount());
});

it("keeps canceled unsaved work usable, then discards and reopens normally", () => {
  const { sheetInstances } = require("@gorhom/bottom-sheet");
  function Harness() {
    const [visible, setVisible] = React.useState(true);
    const [draft, setDraft] = React.useState("");
    const close = useSheetDismiss(
      () => {
        setVisible(false);
        setDraft("");
      },
      !!draft,
      false,
    );
    return (
      <>
        <TouchableOpacity
          accessibilityLabel="Reopen draft"
          onPress={() => setVisible(true)}
        />
        <FundleafSheet
          visible={visible}
          dirty={!!draft}
          title="Protected"
          onDismiss={close}
        >
          <BrandInput
            label="Protected input"
            value={draft}
            onChangeText={setDraft}
          />
        </FundleafSheet>
      </>
    );
  }
  const tree = mount(<Harness />);
  act(() => tree.root.findByType(TextInput).props.onChangeText("Travel"));
  act(() => button(tree, "Dismiss Protected backdrop").props.onPress());
  act(() => button(tree, "Keep editing").props.onPress());
  expect(tree.root.findByType(TextInput).props.value).toBe("Travel");
  act(() => button(tree, "Dismiss Protected").props.onPress());
  act(() => button(tree, "Discard changes").props.onPress());
  expect(button(tree, "Dismiss Protected")).toBeUndefined();
  act(() => button(tree, "Reopen draft").props.onPress());
  expect(tree.root.findByType(TextInput).props.value).toBe("");
  act(() => sheetInstances.get("Protected").swipe());
  expect(button(tree, "Dismiss Protected")).toBeUndefined();
  act(() => tree.unmount());
});

it("waits for an opening modal before processing a close, then reopens", () => {
  const { sheetInstances, sheetLifecycle } = require("@gorhom/bottom-sheet");
  sheetLifecycle.deferPresent = true;
  let setVisible!: React.Dispatch<React.SetStateAction<boolean>>;
  function Harness() {
    const [visible, update] = React.useState(true);
    setVisible = update;
    return (
      <FundleafSheet
        visible={visible}
        title="Opening"
        onDismiss={() => update(false)}
      >
        Content
      </FundleafSheet>
    );
  }
  const tree = mount(<Harness />);
  act(() => setVisible(false));
  expect(sheetLifecycle.dismiss).not.toHaveBeenCalled();
  act(() => sheetInstances.get("Opening").completeOpen());
  expect(sheetLifecycle.dismiss).toHaveBeenCalledTimes(1);
  expect(button(tree, "Dismiss Opening")).toBeUndefined();
  act(() => setVisible(true));
  act(() => sheetInstances.get("Opening").completeOpen());
  expect(button(tree, "Dismiss Opening")).toBeTruthy();
  act(() => tree.unmount());
});

it("consumes Back while a nested sheet finishes closing without closing its parent", () => {
  const { sheetInstances, sheetLifecycle } = require("@gorhom/bottom-sheet");
  sheetLifecycle.deferDismiss = true;
  const parentClose = jest.fn(),
    childClose = jest.fn();
  let setChild!: React.Dispatch<React.SetStateAction<boolean>>;
  function Harness() {
    const [child, update] = React.useState(true);
    setChild = update;
    return (
      <>
        <FundleafSheet visible title="Back parent" onDismiss={parentClose}>
          Parent
        </FundleafSheet>
        <FundleafSheet
          visible={child}
          title="Back child"
          onDismiss={childClose}
        >
          Child
        </FundleafSheet>
      </>
    );
  }
  const tree = mount(<Harness />);
  const childBack = (BackHandler.addEventListener as jest.Mock).mock.calls.at(
    -1,
  )![1];
  act(() => setChild(false));
  act(() => {
    expect(childBack()).toBe(true);
  });
  expect(parentClose).not.toHaveBeenCalled();
  expect(childClose).not.toHaveBeenCalled();
  act(() => sheetInstances.get("Back child").completeClose());
  expect(button(tree, "Dismiss Back parent")).toBeTruthy();
  act(() => tree.unmount());
});
