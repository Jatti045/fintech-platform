/**
 * Manual mock for react-native-animated-numbers used by Jest.
 *
 * The package is a JS component, but keeping it stubbed keeps the Jest
 * environment deterministic (no animation timers) for the budget tests.
 */
import React from "react";

const AnimatedNumber = (props: Record<string, unknown>) =>
  React.createElement("View", props);

export default AnimatedNumber;
