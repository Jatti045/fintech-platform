import React, { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ExpandableProps {
  expanded: boolean;
  children: React.ReactNode;
  duration?: number;
}

/**
 * Smooth height-reveal container.
 *
 * Keeps its content mounted (clipped by `overflow: hidden`) so inner
 * measurements never need to be re-computed when the drawer re-opens.
 */
export default function Expandable({
  expanded,
  children,
  duration = 280,
}: ExpandableProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(expanded ? contentHeight : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, contentHeight, duration, height]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View style={[style, { overflow: "hidden" }]}>
      <View
        onLayout={(e: LayoutChangeEvent) =>
          setContentHeight(e.nativeEvent.layout.height)
        }
      >
        {children}
      </View>
    </Animated.View>
  );
}