import { Easing, ReduceMotion } from "react-native-reanimated";
import { BRAND } from "./ThemePalettes";

const arrive = Easing.bezier(0.23, 1, 0.32, 1);
const travel = Easing.bezier(0.25, 0.85, 0.25, 1);
const reduceMotion = ReduceMotion.System;

export const MOTION = {
  press: { duration: BRAND.motion.press, easing: arrive, reduceMotion },
  release: { duration: BRAND.motion.feedback, easing: arrive, reduceMotion },
  cashFlow: { duration: 390, easing: travel, reduceMotion },
  navigation: {
    duration: BRAND.motion.navigation,
    easing: travel,
    reduceMotion,
  },
  sheet: {
    damping: 30,
    stiffness: 330,
    mass: 0.85,
    overshootClamping: true,
    reduceMotion,
  },
} as const;
