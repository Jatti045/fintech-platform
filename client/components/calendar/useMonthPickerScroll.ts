import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  Animated,
  Platform,
  VirtualizedList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { CalendarState } from "@/types/calendar/types";
import { currentMonthIndex, monthAt } from "./months";

const QUIET_MS = 180;
/** Native animation and gesture drafts remain separate from the reporting month. */
export default function useMonthPickerScroll({
  selected,
  latest,
  count,
  width,
  itemWidth,
  selectedIndex,
  onChange,
}: {
  selected: number;
  latest: number;
  count: number;
  width: number;
  itemWidth: number;
  selectedIndex: number;
  onChange: (value: CalendarState) => void;
}) {
  const list = useRef<VirtualizedList<number>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const dragging = useRef(false);
  const momentum = useRef(false);
  const interacting = useRef(false);
  const requested = useRef<number | null>(null);
  const committed = useRef(selected);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);
  useLayoutEffect(() => {
    if (!width) return;
    clearTimer();
    dragging.current = momentum.current = interacting.current = false;
    requested.current = null;
    committed.current = selected;
    offset.current = selectedIndex * itemWidth;
    scrollX.setValue(offset.current);
    list.current?.scrollToOffset({ offset: offset.current, animated: false });
  }, [selected, latest, width, itemWidth, selectedIndex, scrollX, clearTimer]);

  const settle = () => {
    clearTimer();
    if (
      !interacting.current ||
      dragging.current ||
      momentum.current ||
      !itemWidth
    )
      return;
    const index = Math.max(
      0,
      Math.min(
        count - 1,
        requested.current ?? Math.round(offset.current / itemWidth),
      ),
    );
    const target = index * itemWidth;
    if (Math.abs(offset.current - target) > 0.75) {
      list.current?.scrollToOffset({ offset: target, animated: true });
      timer.current = setTimeout(() => settleRef.current(), QUIET_MS);
      return;
    }
    const next = latest - index;
    interacting.current = false;
    requested.current = null;
    if (next !== committed.current && next <= currentMonthIndex()) {
      committed.current = next;
      onChangeRef.current(monthAt(next));
    }
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const schedule = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => settleRef.current(), QUIET_MS);
  }, [clearTimer]);
  const requestIndex = (index: number) => {
    if (!itemWidth) return;
    const target = Math.max(0, Math.min(count - 1, index));
    clearTimer();
    interacting.current = true;
    dragging.current = momentum.current = false;
    requested.current = target;
    list.current?.scrollToOffset({
      offset: target * itemWidth,
      animated: true,
    });
    schedule();
  };
  const adjust = (direction: number) =>
    requestIndex(
      (requested.current ?? Math.round(offset.current / itemWidth)) + direction,
    );
  const recordScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: Platform.OS !== "web",
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.current = Math.max(0, event.nativeEvent.contentOffset.x);
          if (interacting.current && !dragging.current && !momentum.current)
            schedule();
        },
      }),
    [scrollX, schedule],
  );
  const keyboard =
    Platform.OS === "web"
      ? {
          onKeyDown: (event: {
            nativeEvent: { key: string };
            preventDefault: () => void;
          }) => {
            if (
              event.nativeEvent.key === "ArrowLeft" ||
              event.nativeEvent.key === "ArrowRight"
            ) {
              event.preventDefault();
              adjust(event.nativeEvent.key === "ArrowLeft" ? 1 : -1);
            }
          },
        }
      : {};
  const requestRef = useRef(requestIndex);
  requestRef.current = requestIndex;
  const selectIndex = useCallback(
    (index: number) => requestRef.current(index),
    [],
  );
  return {
    list,
    scrollX,
    selectIndex,
    keyboard,
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === "increment") adjust(-1);
      else if (event.nativeEvent.actionName === "decrement") adjust(1);
    },
    events: {
      ...(Platform.OS === "web"
        ? {
            onWheel: () => {
              clearTimer();
              interacting.current = true;
              dragging.current = momentum.current = false;
              requested.current = null;
              schedule();
            },
          }
        : {}),
      onTouchStart: () => {
        clearTimer();
        interacting.current = dragging.current = true;
        momentum.current = false;
        requested.current = null;
      },
      onTouchCancel: () => {
        dragging.current = false;
        schedule();
      },
      onTouchEnd: () => {
        dragging.current = false;
        schedule();
      },
      onScroll: recordScroll,
      onScrollBeginDrag: () => {
        clearTimer();
        interacting.current = dragging.current = true;
        momentum.current = false;
        requested.current = null;
      },
      onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = Math.max(0, event.nativeEvent.contentOffset.x);
        dragging.current = false;
        schedule();
      },
      onMomentumScrollBegin: () => {
        clearTimer();
        momentum.current = true;
      },
      onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = Math.max(0, event.nativeEvent.contentOffset.x);
        momentum.current = false;
        settleRef.current();
      },
    },
  };
}
