import React, { useEffect } from "react";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "@/constants/Motion";

export default function DisclosureChevron({
  expanded,
  color,
}: {
  expanded: boolean;
  color: string;
}) {
  const angle = useSharedValue(expanded ? 180 : 0);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  useEffect(() => {
    angle.value = withTiming(expanded ? 180 : 0, MOTION.release);
  }, [angle, expanded]);

  return (
    <Animated.View aria-hidden style={style}>
      <Feather name="chevron-down" size={18} color={color} />
    </Animated.View>
  );
}
