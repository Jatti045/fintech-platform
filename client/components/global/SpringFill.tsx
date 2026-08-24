import React, { useEffect } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export interface SpringFillProps {
  /** 0..1 fill ratio. */
  ratio: number;
  trackColor: string;
  colors?: [string, string];
  height?: number;
  radius?: number;
}

/**
 * A liquid fill bar whose width springs to `ratio` on every change — the
 * shared motion used by budget reservoir rows.
 */
export default function SpringFill({
  ratio,
  trackColor,
  colors,
  height = 8,
  radius = 999,
}: SpringFillProps) {
  const p = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    p.value = withSpring(clamped, {
      damping: 18,
      stiffness: 120,
      mass: 0.8,
    });
  }, [clamped, p]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${p.value * 100}%`,
  }));

  return (
    <View
      style={{
        height,
        backgroundColor: trackColor,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <Animated.View style={[fillStyle, { height: "100%" }]}>
        <LinearGradient
          colors={colors ?? ["#D4AF6A", "#F0D9A0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}