/**
 * Manual mock for react-native used by Jest.
 * Only the APIs actually referenced by non-component code are stubbed here.
 * View/Text/Switch are provided so light component tests can render.
 */

import React from "react";

export const Platform = {
  OS: "ios",
  select: (obj: Record<string, any>) => obj.ios ?? obj.default,
};

export const AppState = {
  currentState: "active",
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

export const NativeModules = {};
export const NativeEventEmitter = jest.fn().mockImplementation(() => ({
  addListener: jest.fn(),
  removeListeners: jest.fn(),
}));

// Minimal host-component stubs used by component tests. They render to host
// elements so react-test-renderer can mount trees and inspect props.
const hostComponent = (name: string) =>
  jest.fn((props: Record<string, unknown>) => React.createElement(name, props));

export const View = hostComponent("View");
export const Text = hostComponent("Text");
export const Switch = hostComponent("Switch");
export const TextInput = hostComponent("TextInput");
export const TouchableOpacity = hostComponent("TouchableOpacity");
export const ScrollView = hostComponent("ScrollView");
export const KeyboardAvoidingView = hostComponent("KeyboardAvoidingView");
export const TouchableWithoutFeedback = hostComponent(
  "TouchableWithoutFeedback",
);
export const ActivityIndicator = hostComponent("ActivityIndicator");
export const RefreshControl = hostComponent("RefreshControl");

// SectionList mirrors the real behaviour closely enough for tests: it invokes
// renderSectionHeader + renderItem for each section/item and mounts them as
// children so component tests can inspect the rendered rows. It also renders
// ListEmptyComponent when there are no items.
export const SectionList = jest.fn(
  (props: Record<string, any>): React.ReactElement => {
    const sections = props.sections ?? [];
    const children: React.ReactNode[] = [];
    for (const section of sections) {
      const header = props.renderSectionHeader?.({ section });
      if (header) children.push(header);
      const data = section.data ?? [];
      for (let i = 0; i < data.length; i++) {
        const item = props.renderItem?.({
          item: data[i],
          index: i,
          section,
          separators: {},
        });
        if (item) children.push(item);
      }
    }
    if (children.length === 0 && props.ListEmptyComponent) {
      children.push(props.ListEmptyComponent);
    }
    if (props.ListFooterComponent) {
      children.push(props.ListFooterComponent);
    }
    return React.createElement("SectionList", props, children);
  },
);

// Modal mirrors the native behaviour of only mounting its children while
// visible, so component tests can assert on modal content per visibility.
export const Modal = jest.fn((props: Record<string, unknown>) => {
  if (!props.visible) return null;
  return React.createElement("Modal", props);
});

export const Keyboard = {
  dismiss: jest.fn(),
};

// Minimal `Animated` used by components that reference it as a runtime value
// (e.g. SwipeableRow renders <Animated.View>). Type-level members come from
// the real react-native types.
export const Animated = {
  View: hostComponent("View"),
  Text: hostComponent("Text"),
  Image: hostComponent("Image"),
  Value: class {
    _value: unknown;
    constructor(value: unknown) {
      this._value = value;
    }
    setValue(value: unknown) {
      this._value = value;
    }
    getValue() {
      return this._value;
    }
    addListener() {
      return { remove: () => undefined };
    }
    removeListener() {}
  },
  timing: () => ({
    start: (cb?: (result: { finished: boolean }) => void) =>
      cb?.({ finished: true }),
  }),
  spring: () => ({
    start: (cb?: (result: { finished: boolean }) => void) =>
      cb?.({ finished: true }),
  }),
  createAnimatedComponent: <T,>(Component: T) => Component,
};

const WINDOW = { width: 400, height: 800, scale: 2, fontScale: 1 };

export const Dimensions = {
  get: jest.fn(() => WINDOW),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  set: jest.fn(),
};

export const useWindowDimensions = () => WINDOW;

// StyleSheet.create is used widely (e.g. GlassPanel). Identity is enough for
// tests — style objects are just passed through to the host mocks.
export const StyleSheet = {
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: { position: "absolute" as const },
  create: (styles: Record<string, any>) => styles,
  flatten: (style: any) => style,
  compose: (...styles: any[]) => styles[0],
  setStyleAttributePreprocessor: jest.fn(),
};
