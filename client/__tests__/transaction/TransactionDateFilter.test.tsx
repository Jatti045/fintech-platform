import React from "react";
import renderer, { act } from "react-test-renderer";
import { TouchableOpacity } from "react-native";
import TransactionDateFilter from "@/components/transaction/TransactionDateFilter";

jest.mock("@/hooks/useRedux", () => ({
  useTheme: () => ({ THEME: new Proxy({}, { get: () => "#123456" }) }),
}));

test.each([
  [2026, 1, 28],
  [2028, 1, 29],
  [2026, 11, 31],
])("limits %i month %i to its %i valid days", (year, month, count) => {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const date = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <TransactionDateFilter
        visible
        month={month}
        year={year}
        selectedDate={date}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
  });
  const days = tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) =>
      /^\d{4}-\d{2}-\d{2}$/.test(node.props.accessibilityLabel ?? ""),
    );
  expect(days).toHaveLength(count);
  expect(days[0].props.accessibilityState.selected).toBe(true);
  act(() => {
    days[0].props.onPress();
  });
  expect(onSelect).toHaveBeenCalledWith(date);
  expect(onClose).toHaveBeenCalledTimes(1);
  onSelect.mockClear();
  act(() => {
    tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === "Close calendar")!
      .props.onPress();
  });
  expect(onSelect).not.toHaveBeenCalled();
  act(() => {
    tree.unmount();
  });
});
