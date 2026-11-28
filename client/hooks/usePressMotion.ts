import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "@/constants/Motion";

export function usePressMotion() {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return {
    style,
    onPressIn: () => {
      if (!reduced) scale.value = withTiming(0.97, MOTION.press);
    },
    onPressOut: () => {
      scale.value = withTiming(1, MOTION.release);
    },
  };
}
