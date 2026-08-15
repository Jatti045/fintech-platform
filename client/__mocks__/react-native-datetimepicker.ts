/**
 * Manual mock for @react-native-community/datetimepicker used by Jest.
 *
 * The real package installs a native iOS/Android picker. The transaction
 * modal renders the picker conditionally; in tests it only needs to mount.
 */
import React from "react";

const DateTimePicker = (props: Record<string, unknown>) =>
  React.createElement("View", props);

export default DateTimePicker;
