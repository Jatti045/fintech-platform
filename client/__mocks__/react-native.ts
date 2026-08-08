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
export const View = jest.fn((props: Record<string, unknown>) =>
  React.createElement("View", props),
);
export const Text = jest.fn((props: Record<string, unknown>) =>
  React.createElement("Text", props),
);
export const Switch = jest.fn((props: Record<string, unknown>) =>
  React.createElement("Switch", props),
);
