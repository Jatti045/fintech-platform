import React, { useEffect } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { MOTION } from "@/constants/Motion";
import { useTheme } from "@/hooks/useRedux";

export type CashFlowBranch = "spent" | "left";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const TOP = 20;
const HEIGHT = 68;
const START = 4;
const END = 296;

function ribbon(start: number, end: number, height: number) {
  return [
    `M ${START} ${start} C 103 ${start} 197 ${end} ${END} ${end}`,
    `v ${height} C 197 ${end + height} 103 ${start + height} ${START} ${start + height} Z`,
  ].join(" ");
}

/** The ribbon widths show the share of income that went to each destination. */
export default function CashFlowRibbons({
  spentShare,
  spentColor,
  selected,
  trace,
}: {
  spentShare: number;
  spentColor: string;
  selected: CashFlowBranch;
  trace: number;
}) {
  const { THEME } = useTheme();
  const progress = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const spentHeight = HEIGHT * spentShare;
  const leftHeight = HEIGHT - spentHeight;
  // When all income goes to one branch, center its ribbon.
  const spentEnd = leftHeight === 0 ? TOP : 4;
  const leftEnd = spentHeight === 0 ? TOP : 90 - leftHeight;
  const bands = {
    spent: {
      start: TOP,
      end: spentEnd,
      height: spentHeight,
      color: spentColor,
    },
    left: {
      start: TOP + spentHeight,
      end: leftEnd,
      height: leftHeight,
      color: THEME.success,
    },
  };
  const { start, end, height, color } = bands[selected];

  useEffect(() => {
    if (trace === 0 || reduceMotion || height <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, MOTION.cashFlow);
    return () => cancelAnimation(progress);
  }, [trace, reduceMotion, height, progress]);

  const pulse = useAnimatedProps(() => {
    const t = progress.value;
    const s = 1 - t;
    // The trace follows the same cubic centerline as the ribbon.
    const cx =
      s * s * s * START +
      3 * s * s * t * 103 +
      3 * s * t * t * 197 +
      t * t * t * END;
    const cy =
      (1 - t * t * (3 - 2 * t)) * start +
      t * t * (3 - 2 * t) * end +
      height / 2;
    return { cx, cy, opacity: Math.min(t * 12, s * 7, 1) };
  });

  return (
    <Svg
      width="100%"
      height={94}
      viewBox="0 0 300 94"
      preserveAspectRatio="none"
      aria-hidden
    >
      {(["spent", "left"] as const).map((key) => {
        const band = bands[key];
        if (band.height <= 0) return null;
        return (
          <React.Fragment key={key}>
            <Path
              d={ribbon(band.start, band.end, band.height)}
              fill={band.color}
              fillOpacity={key === selected ? 0.28 : 0.14}
            />
            <Path
              d={`M ${END} ${band.end} v ${band.height}`}
              stroke={band.color}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </React.Fragment>
        );
      })}
      <Path
        d={`M ${START} ${TOP} v ${HEIGHT}`}
        stroke={THEME.primary}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <AnimatedCircle animatedProps={pulse} r={3} fill={color} opacity={0} />
    </Svg>
  );
}
