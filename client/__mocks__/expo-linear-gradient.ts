/**
 * Manual mock for expo-linear-gradient used by Jest.
 *
 * The real package ships untranspiled ESM which the ts-jest/node transformer
 * cannot execute, so both the component and its static helpers are stubbed
 * deterministically for tests.
 */
import React from "react";
import { View } from "react-native";

/** Renders children inside a plain View, ignoring gradient maths. */
export function LinearGradient({
  children,
  style,
  colors: _colors,
  start: _start,
  end: _end,
  locations: _locations,
  ...rest
}: {
  children?: React.ReactNode;
  style?: unknown;
  colors?: unknown;
  start?: unknown;
  end?: unknown;
  locations?: unknown;
} & Record<string, unknown>) {
  return React.createElement(View, { ...rest, style: style as never }, children);
}

export const LinearGradientBackground = LinearGradient;

export default LinearGradient;
