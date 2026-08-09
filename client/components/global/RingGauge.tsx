import React, { useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(
  Circle as unknown as React.ComponentType<Record<string, unknown>>,
);

export interface RingSegmentSpec {
  /** Fraction of the full ring (0..1) taken by this segment. */
  fraction: number;
  color: string;
}

export interface RingGaugeProps {
  size: number;
  strokeWidth: number;
  /** 0..1 progress drawn by the outer arc. */
  progress: number;
  /** Solid stroke colour for the outer arc. */
  color?: string;
  /** Optional gradient (start → end) for the outer arc. */
  gradient?: [string, string];
  /** Inner distribution segments. */
  segments?: RingSegmentSpec[];
  /** Stroke width of the inner distribution segments. */
  segmentsStrokeWidth?: number;
  /** Colour of the background track ring. */
  trackColor?: string;
  rounded?: boolean;
  /** Unique id for the SVG gradient def (must differ per mounted instance). */
  gradientId?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface SegmentArcProps {
  spec: RingSegmentSpec;
  startFraction: number;
  t: SharedValue<number>;
  size: number;
  radius: number;
  strokeWidth: number;
  circumference: number;
}

function SegmentArc({
  spec,
  startFraction,
  t,
  size,
  radius,
  strokeWidth,
  circumference,
}: SegmentArcProps) {
  const animatedProps = useAnimatedProps(() => {
    const start = startFraction * t.value;
    const len = Math.max(0, spec.fraction * t.value * circumference);
    return {
      strokeDasharray: `${len} ${circumference}`,
      strokeDashoffset: circumference * (1 - start),
    };
  });

  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke={spec.color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="butt"
      strokeDasharray={`0 ${circumference}`}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Animated multi-layer dial ring.
 *
 * On mount (and whenever `progress` changes) the whole dial “spins up”:
 * the outer arc sweeps clockwise to `progress` while inner segments grow
 * from 12 o’clock into their final distribution — the signature motion of
 * the Budget Halo and Goal Summit hero.
 */
export default function RingGauge({
  size,
  strokeWidth,
  progress,
  color = "#D4AF6A",
  gradient,
  segments = [],
  segmentsStrokeWidth,
  trackColor,
  rounded = true,
  gradientId = "ring-gradient",
  children,
  style,
}: RingGaugeProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withSpring(1, { damping: 20, stiffness: 92, mass: 0.9 });
  }, [t, clamped]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segWidth = segmentsStrokeWidth ?? Math.max(5, strokeWidth - 7);
  const segRadius = Math.max(4, radius - strokeWidth / 2 - segWidth / 2 - 5);

  const segmentSpecs = useMemo(() => {
    let running = 0;
    return segments.map((seg) => {
      const start = running;
      running += seg.fraction;
      return { spec: seg, startFraction: start };
    });
  }, [segments]);

  const primaryProps = useAnimatedProps(() => {
    const len = circumference * clamped * t.value;
    return {
      strokeDasharray: `${len} ${circumference}`,
      strokeDashoffset: circumference - len,
    };
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* Rotated -90° so arcs start at 12 o’clock. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: "-90deg" }] },
        ]}
      >
        <Svg width={size} height={size}>
          {gradient && (
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={gradient[0]} />
                <Stop offset="1" stopColor={gradient[1]} />
              </LinearGradient>
            </Defs>
          )}

          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor ?? color}
            strokeOpacity={0.16}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Inner distribution segments */}
          {segmentSpecs.map(({ spec, startFraction }, i) => (
            <SegmentArc
              key={`${spec.color}-${i}`}
              spec={spec}
              startFraction={startFraction}
              t={t}
              size={size}
              radius={segRadius}
              strokeWidth={segWidth}
              circumference={circumference}
            />
          ))}

          {/* Primary progress arc */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={gradient ? `url(#${gradientId})` : color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap={rounded ? "round" : "butt"}
            strokeDasharray={`0 ${circumference}`}
            animatedProps={primaryProps}
          />
        </Svg>
      </View>

      {/* Centered readout */}
      {children ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.center}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});