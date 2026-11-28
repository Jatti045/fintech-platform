import React from "react";

export default React.forwardRef(function ReanimatedSwipeable(
  { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
  ref,
) {
  React.useImperativeHandle(ref, () => ({ close: () => {} }));
  return React.createElement("View", props, children);
});
