/**
 * Manual mock for react-native-safe-area-context used by Jest.
 *
 * The real package renders through native modules that are not available in
 * the Jest/node environment. This mock provides a renderable SafeAreaView and
 * zero insets so screens and modals can mount in component tests.
 */
import React from "react";

export const SafeAreaView = jest.fn((props: Record<string, unknown>) =>
  React.createElement("SafeAreaView", props),
);

export const SafeAreaProvider = ({
  children,
}: {
  children?: React.ReactNode;
}) => React.createElement(React.Fragment, null, children);

export const useSafeAreaInsets = () => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 400, height: 800 });

export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};
