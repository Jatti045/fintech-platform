/**
 * Stub for `@expo/vector-icons`.
 *
 * The real package loads native font config that is not available in the
 * Jest/node environment. This mock returns no-op components so component
 * tests can render without importing the native module.
 */
import React from "react";

const NoopIcon = (_props: Record<string, unknown>) => null;

export const Feather = NoopIcon;
export const Ionicons = NoopIcon;
export const MaterialIcons = NoopIcon;
export const MaterialCommunityIcons = NoopIcon;

const VectorIcons = {
  Feather,
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
};

export default VectorIcons;