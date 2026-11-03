import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  AppState,
  View,
  VirtualizedList,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "@/hooks/useRedux";
import type { CalendarState } from "@/types/calendar/types";
import { currentMonthIndex, monthIndex, monthLabels } from "./months";

import MonthItem from "./MonthItem";
import useMonthPickerScroll from "./useMonthPickerScroll";

const HISTORY_CHUNK = 120;
const AnimatedMonths = Animated.createAnimatedComponent(
  VirtualizedList<number>,
);
const itemKey = (item: number) => String(item);
const getItem = (data: { latest: number }, index: number) =>
  data.latest - index;
const getCount = (data: { count: number }) => data.count;

export interface MonthPickerProps {
  value: CalendarState;
  onChange: (value: CalendarState) => void;
}

/** Only settled selection leaves this component; animation never drives API state. */
export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const { THEME } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [latest, setLatest] = useState(currentMonthIndex);
  const [history, setHistory] = useState(HISTORY_CHUNK * 2);
  const selected = monthIndex(value);
  const selectedIndex = Math.max(0, latest - selected);
  const count = Math.max(history, selectedIndex + HISTORY_CHUNK);
  const itemWidth = Math.min(104 * Math.max(1, fontScale), width * 0.66);
  const height = Math.ceil(58 * Math.max(1, fontScale));
  const data = useMemo(() => ({ latest, count }), [latest, count]);
  // Keep the future-month boundary fresh across midnight and app suspension.
  useEffect(() => {
    const update = () => setLatest(currentMonthIndex());
    const clock = setInterval(update, 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(clock);
      subscription.remove();
    };
  }, []);

  const {
    list,
    scrollX,
    selectIndex,
    keyboard,
    onAccessibilityAction,
    events,
  } = useMonthPickerScroll({
    selected,
    latest,
    count,
    width,
    itemWidth,
    selectedIndex,
    onChange,
  });
  return (
    <View
      {...keyboard}
      accessible
      focusable
      accessibilityRole="adjustable"
      accessibilityLabel="Reporting month"
      accessibilityHint="Swipe horizontally, tap a month, or use adjustment actions to select a reporting month"
      accessibilityValue={{
        min: latest - count + 1,
        max: latest,
        now: Math.min(selected, latest),
        text: monthLabels(selected).full,
      }}
      aria-valuemin={latest - count + 1}
      aria-valuemax={latest}
      aria-valuenow={Math.min(selected, latest)}
      aria-valuetext={monthLabels(selected).full}
      accessibilityActions={[
        { name: "increment", label: "Later month" },
        { name: "decrement", label: "Earlier month" },
      ]}
      onAccessibilityAction={onAccessibilityAction}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0)
          setWidth((previous) =>
            Math.abs(previous - next) > 0.5 ? next : previous,
          );
      }}
      style={{
        height,
        width: "100%",
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      {width > 0 && (
        <>
          <View
            pointerEvents="none"
            accessible={false}
            style={{
              position: "absolute",
              left: (width - itemWidth) / 2 + 5,
              width: itemWidth - 10,
              top: 5,
              bottom: 5,
              borderRadius: 14,
              backgroundColor: THEME.subtleSurface,
            }}
          />
          <AnimatedMonths
            ref={list}
            horizontal
            inverted
            data={data}
            getItem={getItem}
            getItemCount={getCount}
            keyExtractor={itemKey}
            initialScrollIndex={selectedIndex}
            getItemLayout={(_, index) => ({
              length: itemWidth,
              offset: index * itemWidth,
              index,
            })}
            renderItem={({ item, index }) => (
              <MonthItem
                month={item}
                index={index}
                width={itemWidth}
                height={height}
                selected={item === selected}
                scrollX={scrollX}
                onSelect={selectIndex}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: (width - itemWidth) / 2,
            }}
            showsHorizontalScrollIndicator={false}
            snapToInterval={itemWidth}
            snapToAlignment="start"
            decelerationRate="fast"
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled
            directionalLockEnabled
            initialNumToRender={7}
            maxToRenderPerBatch={7}
            windowSize={5}
            onEndReached={() =>
              setHistory(
                (previous) => Math.max(previous, count) + HISTORY_CHUNK,
              )
            }
            onEndReachedThreshold={1}
            scrollEventThrottle={16}
            {...events}
          />
        </>
      )}
    </View>
  );
}
