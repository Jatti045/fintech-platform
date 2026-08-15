/**
 * Manual mock for react-native-gesture-handler used by Jest.
 *
 * The real package installs native gesture recognizers that are not available
 * in the Jest environment. `Swipeable` and the root wrapper render their
 * children as plain Views so rows can mount in component tests.
 */
import React from "react";

const passthrough = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const Swipeable = ({
  children,
  ...rest
}: { children?: React.ReactNode } & Record<string, unknown>) =>
  React.createElement("View", rest, children);

export const GestureHandlerRootView = passthrough;
export const GestureDetector = passthrough;
export const PanGestureHandler = passthrough;
export const TapGestureHandler = passthrough;
export const State = { END: 5, ACTIVE: 4 };

export const Gesture = {
  Pan: () => ({ runOnJS: () => ({}) }),
  Tap: () => ({ runOnJS: () => ({}) }),
};

export default { Swipeable, GestureHandlerRootView, GestureDetector };
