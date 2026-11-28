import React, { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const leaf = "M5 17C4.5 10 9.5 5 20 4C20 12 16 18 9 18C7.5 18 6 17.7 5 17Z";
const vein = "M4 21C7 16 10.5 13 15 10";

export default function FundleafLoader({
  color,
  size = "small",
  accessibilityLabel = "Loading",
  style,
}: {
  color: string;
  size?: "small" | "large";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      }),
      0,
      false,
      undefined,
      ReduceMotion.System,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduced]);

  const trace = useAnimatedProps(() => ({
    strokeDashoffset: 7 - progress.value * 31,
    opacity: Math.min(progress.value * 8, (1 - progress.value) * 5, 1),
  }));

  const dimension = size === "large" ? 44 : 20;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      style={[{ alignItems: "center", justifyContent: "center" }, style]}
    >
      <Svg width={dimension} height={dimension} viewBox="0 0 24 24" aria-hidden>
        <Path
          d={leaf}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          opacity={0.65}
        />
        <Path
          d={vein}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <AnimatedPath
          d={leaf}
          animatedProps={trace}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={[11, 38]}
          strokeLinecap="round"
          opacity={0}
        />
      </Svg>
    </View>
  );
}
