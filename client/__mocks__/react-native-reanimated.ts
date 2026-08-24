/**
 * Manual mock for react-native-reanimated used by Jest.
 *
 * Reanimated ships native worklets that cannot run in the Jest/node
 * environment. These stubs make the animated primitives render as plain
 * components and make the animation hooks behave as identity/no-ops so the
 * budget UI can mount in component tests.
 */
import React from "react";

export const Easing = {
  out: (e: unknown) => e,
  in: (e: unknown) => e,
  inOut: (e: unknown) => e,
  linear: (v: number) => v,
  cubic: (v: number) => v,
};

export const useSharedValue = (initial: unknown) => ({ value: initial });
export const useAnimatedStyle = (factory: () => unknown) =>
  typeof factory === "function" ? factory() : {};
export const useAnimatedProps = (factory: () => unknown) =>
  typeof factory === "function" ? factory() : {};
export const useDerivedValue = (factory: () => unknown) => ({
  value: typeof factory === "function" ? factory() : undefined,
});
export const useAnimatedReaction = () => undefined;
export const withTiming = (toValue: unknown) => toValue;
export const withSpring = (toValue: unknown) => toValue;
export const cancelAnimation = () => undefined;
export const runOnJS = (fn: unknown) => fn;
export const runOnUI = (fn: unknown) => fn;
export const interpolate = (value: unknown) => value;
export const interpolateColor = (value: unknown) => value;
export const Extrapolation = { CLAMP: 0, EXTEND: 1, IDENTITY: 2 };
export const createAnimatedComponent = <T,>(Component: T) => Component;

const animatedComponent = (name: string) =>
  function AnimatedMock(props: Record<string, unknown>) {
    return React.createElement(name, props);
  };

export const Animated = {
  View: animatedComponent("View"),
  Text: animatedComponent("Text"),
  ScrollView: animatedComponent("ScrollView"),
  Image: animatedComponent("Image"),
  createAnimatedComponent,
};

// The real module's default export is the `Animated` namespace (Animated.View,
// Animated.Text, Animated.createAnimatedComponent, …).
export default Animated;
