import React from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { TouchableOpacity } from "react-native";
import * as Native from "react-native";
import MonthPicker from "@/components/calendar/MonthPicker";
import { monthAt, monthIndex, monthLabels } from "@/components/calendar/months";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";

const scrollTo = (Native as any).virtualizedListScrollToOffset as jest.Mock;
const event = (x: number) => ({ nativeEvent: { contentOffset: { x } } });
const initial = { month: 11, year: 2026 };
function setup(theme = "Light") {
  const store = configureStore({ reducer: { theme: themeReducer } });
  store.dispatch(setTheme(theme));
  const changed = jest.fn();
  const element = (value = initial) => (
    <Provider store={store}>
      <MonthPicker value={value} onChange={changed} />
    </Provider>
  );
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element());
  });
  const root = () =>
    tree.root
      .findAllByType("View" as any)
      .find((node) => node.props.accessibilityRole === "adjustable")!;
  act(() => root().props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
  const list = () => tree.root.findByType("VirtualizedList" as any).props;
  return { tree, root, list, changed, element };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2027-07-10T12:00:00Z"));
  scrollTo.mockClear();
});
afterEach(() => jest.useRealTimers());

it.each(["Light", "Dark"])(
  "centers the selected month and virtualizes history in %s",
  (theme) => {
    const { tree, list, changed } = setup(theme);
    expect(list().initialScrollIndex).toBe(7);
    expect(list().contentContainerStyle.paddingHorizontal).toBe(
      (320 - list().snapToInterval) / 2,
    );
    expect(scrollTo).toHaveBeenLastCalledWith({
      offset: 7 * list().snapToInterval,
      animated: false,
    });
    expect(tree.root.findAllByType(TouchableOpacity).length).toBeLessThan(12);
    expect(changed).not.toHaveBeenCalled();
    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .some((node) =>
          /Previous month|Next month/.test(node.props.accessibilityLabel),
        ),
    ).toBe(false);
    act(() => tree.unmount());
  },
);
it("commits one final month after a fast swipe, across December and January", () => {
  const { tree, list, changed } = setup();
  const width = list().snapToInterval;
  act(() => {
    list().onScrollBeginDrag();
    list().onScroll(event(9 * width));
  });
  act(() => jest.advanceTimersByTime(1000));
  expect(changed).not.toHaveBeenCalled();
  act(() => {
    list().onScrollEndDrag(event(9 * width));
    list().onMomentumScrollBegin();
    list().onScroll(event(6 * width));
  });
  act(() => jest.advanceTimersByTime(1000));
  expect(changed).not.toHaveBeenCalled();
  act(() => list().onMomentumScrollEnd(event(6 * width)));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenLastCalledWith({ month: 0, year: 2027 });
  act(() => {
    list().onMomentumScrollEnd(event(6 * width));
    jest.advanceTimersByTime(1000);
  });
  expect(changed).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it("snaps a slow drag before committing, even without momentum events", () => {
  const { tree, list, changed } = setup();
  const width = list().snapToInterval;
  act(() => {
    list().onScrollBeginDrag();
    list().onScroll(event(8.3 * width));
    list().onScrollEndDrag(event(8.3 * width));
    jest.advanceTimersByTime(180);
  });
  expect(scrollTo).toHaveBeenLastCalledWith({
    offset: 8 * width,
    animated: true,
  });
  expect(changed).not.toHaveBeenCalled();
  act(() => {
    list().onScroll(event(8 * width));
    jest.advanceTimersByTime(180);
  });
  expect(changed).toHaveBeenCalledWith({ month: 10, year: 2026 });
  act(() => tree.unmount());
});
it("supports tapping and screen-reader adjustment while blocking future months", () => {
  const { tree, root, list, changed } = setup();
  const january = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.accessibilityLabel === "Select January 2027")!;
  act(() => january.props.onPress());
  expect(changed).not.toHaveBeenCalled();
  act(() => {
    list().onScroll(event(6 * list().snapToInterval));
    jest.advanceTimersByTime(180);
  });
  expect(changed).toHaveBeenLastCalledWith({ month: 0, year: 2027 });
  act(() =>
    root().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    }),
  );
  act(() => list().onMomentumScrollEnd(event(5 * list().snapToInterval)));
  expect(changed).toHaveBeenLastCalledWith({ month: 1, year: 2027 });
  act(() => {
    list().onScrollBeginDrag();
    list().onScrollEndDrag(event(-100));
    jest.advanceTimersByTime(180);
  });
  expect(changed).toHaveBeenLastCalledWith({ month: 6, year: 2027 });
  const calls = changed.mock.calls.length;
  act(() => {
    root().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    });
    jest.advanceTimersByTime(180);
  });
  expect(changed).toHaveBeenCalledTimes(calls);
  act(() => tree.unmount());
});
it("recenters external changes and resizing without committing an old in-flight month", () => {
  const { tree, root, list, changed, element } = setup();
  act(() => {
    list().onScrollBeginDrag();
    list().onScroll(event(4 * list().snapToInterval));
  });
  act(() => tree.update(element({ month: 0, year: 2025 })));
  expect(scrollTo).toHaveBeenLastCalledWith({
    offset: 30 * list().snapToInterval,
    animated: false,
  });
  act(() => {
    root().props.onLayout({ nativeEvent: { layout: { width: 200 } } });
    list().onMomentumScrollEnd(event(4 * list().snapToInterval));
    jest.advanceTimersByTime(1000);
  });
  expect(list().contentContainerStyle.paddingHorizontal).toBe(
    (200 - list().snapToInterval) / 2,
  );
  expect(changed).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it("extends historical months without shifting existing offsets or keys", () => {
  const { tree, list, changed } = setup();
  const before = list();
  const count = before.getItemCount(before.data);
  scrollTo.mockClear();
  act(() => before.onEndReached());
  const after = list();
  expect(after.getItemCount(after.data)).toBeGreaterThan(count);
  expect(after.getItem(after.data, count - 1)).toBe(
    before.getItem(before.data, count - 1),
  );
  expect(scrollTo).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it("cleans up pending selection on unmount", () => {
  const { tree, list, changed } = setup();
  act(() => {
    list().onScrollBeginDrag();
    list().onScrollEndDrag(event(8 * list().snapToInterval));
  });
  act(() => tree.unmount());
  act(() => jest.advanceTimersByTime(1000));
  expect(changed).not.toHaveBeenCalled();
});
it("uses calendar-month arithmetic through leap years and historical years", () => {
  expect(monthAt(monthIndex({ month: 11, year: 2026 }) + 1)).toEqual({
    month: 0,
    year: 2027,
  });
  expect(monthAt(monthIndex({ month: 1, year: 2024 }) + 1)).toEqual({
    month: 2,
    year: 2024,
  });
  expect(monthAt(-1)).toEqual({ month: 11, year: -1 });
  expect(monthLabels(monthIndex({ month: 0, year: 99 })).full).not.toContain(
    "1999",
  );
});

it("supports keyboard and wheel selection on web without intermediate commits", () => {
  const original = Native.Platform.OS;
  (Native.Platform as any).OS = "web";
  try {
    const { tree, root, list, changed } = setup();
    const preventDefault = jest.fn();
    act(() =>
      root().props.onKeyDown({
        nativeEvent: { key: "ArrowLeft" },
        preventDefault,
      }),
    );
    expect(preventDefault).toHaveBeenCalled();
    act(() => {
      list().onScroll(event(8 * list().snapToInterval));
      jest.advanceTimersByTime(180);
    });
    expect(changed).toHaveBeenLastCalledWith({ month: 10, year: 2026 });
    act(() => {
      list().onWheel();
      list().onScroll(event(6 * list().snapToInterval));
      jest.advanceTimersByTime(170);
    });
    expect(changed).toHaveBeenCalledTimes(1);
    act(() => {
      list().onWheel();
      list().onScroll(event(5 * list().snapToInterval));
      jest.advanceTimersByTime(180);
    });
    expect(changed).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenLastCalledWith({ month: 1, year: 2027 });
    expect(root().props["aria-valuetext"]).toBe("December 2026");
    act(() => tree.unmount());
  } finally {
    (Native.Platform as any).OS = original;
  }
});
it("settles an interrupted fling when the user touches to stop it", () => {
  const { tree, list, changed } = setup();
  const width = list().snapToInterval;
  act(() => {
    list().onScrollBeginDrag();
    list().onMomentumScrollBegin();
    list().onScroll(event(8.2 * width));
    list().onTouchStart();
    jest.advanceTimersByTime(1000);
  });
  expect(changed).not.toHaveBeenCalled();
  act(() => {
    list().onTouchEnd();
    jest.advanceTimersByTime(180);
  });
  expect(scrollTo).toHaveBeenLastCalledWith({
    offset: 8 * width,
    animated: true,
  });
  act(() => {
    list().onScroll(event(8 * width));
    jest.advanceTimersByTime(180);
  });
  expect(changed).toHaveBeenCalledWith({ month: 10, year: 2026 });
  act(() => tree.unmount());
});
it("adapts slot size and height for enlarged system text", () => {
  const dimensions = Native.useWindowDimensions();
  const dimensionsMock = jest
    .spyOn(Native, "useWindowDimensions")
    .mockReturnValue({
      ...dimensions,
      fontScale: 2,
    });
  try {
    const { tree, root, list } = setup();
    expect(root().props.style.height).toBe(116);
    expect(list().snapToInterval).toBe(208);
    expect(list().contentContainerStyle.paddingHorizontal).toBe(56);
    act(() => tree.unmount());
  } finally {
    dimensionsMock.mockRestore();
  }
});
