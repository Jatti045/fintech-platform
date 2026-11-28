import React, { useContext, useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { CommonActions, useLinkBuilder } from "@react-navigation/native";
import { PlatformPressable } from "@react-navigation/elements";
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useRedux";
import { hapticSelection } from "@/utils/haptics";
import { BRAND } from "@/constants/ThemePalettes";
import { MOTION } from "@/constants/Motion";
import {
  FLOATING_TAB_BAR as DOCK,
  getFloatingTabBarHeight,
} from "@/constants/appConfig";

type Tab = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};
const tabs: Record<string, Tab> = {
  index: { name: "Home", label: "Home", icon: "home" },
  transaction: { name: "Transactions", label: "Activity", icon: "list" },
  budget: { name: "Budgets", label: "Budgets", icon: "pie-chart" },
  profile: { name: "Profile", label: "Profile", icon: "user" },
};

export default function FundleafTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { THEME } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { buildHref } = useLinkBuilder();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const [keyboardShown, setKeyboardShown] = useState(() =>
    Keyboard.isVisible(),
  );

  const height = getFloatingTabBarHeight(fontScale);
  const reservedHeight = height + DOCK.gap * 2 + insets.bottom;
  const innerWidth =
    Math.min(
      DOCK.maxWidth,
      width - insets.left - insets.right - DOCK.margin * 2,
    ) -
    DOCK.padding * 2;
  const slotWidth = innerWidth / state.routes.length;
  const activeSlot = useSharedValue(state.index);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeSlot.value * slotWidth }],
  }));

  useEffect(() => {
    activeSlot.value = withTiming(state.index, MOTION.navigation);
  }, [activeSlot, state.index]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardShown(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    reportHeight?.(keyboardShown ? 0 : reservedHeight);
  }, [keyboardShown, reportHeight, reservedHeight]);

  if (keyboardShown) return null;

  return (
    <View
      testID="floating-tab-bar-space"
      style={{
        paddingTop: DOCK.gap,
        paddingBottom: insets.bottom + DOCK.gap,
        paddingLeft: insets.left + DOCK.margin,
        paddingRight: insets.right + DOCK.margin,
        alignItems: "center",
        backgroundColor: THEME.background,
      }}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Main navigation"
        style={[
          styles.dock,
          {
            width: "100%",
            maxWidth: DOCK.maxWidth,
            height,
            padding: DOCK.padding,
            backgroundColor: THEME.surface,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          aria-hidden
          testID="active-tab-indicator"
          style={[
            styles.indicator,
            { width: slotWidth - 4, backgroundColor: THEME.accentSurface },
            indicatorStyle,
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const selected = index === state.index;
          const item = tabs[route.name] ?? {
            name: route.name,
            label: route.name,
            icon: "circle" as const,
          };
          const color = selected ? THEME.primary : THEME.textSecondary;

          return (
            <PlatformPressable
              key={route.key}
              href={buildHref(route.name, route.params)}
              accessibilityRole="tab"
              accessibilityLabel={options.tabBarAccessibilityLabel || item.name}
              accessibilityState={{ selected }}
              testID={options.tabBarButtonTestID}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) {
                  hapticSelection();
                  navigation.dispatch({
                    ...CommonActions.navigate(route),
                    target: state.key,
                  });
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
              pressOpacity={0.74}
              pressColor={THEME.accentSurface}
              style={styles.tab}
            >
              <Feather
                name={item.icon}
                size={19}
                color={color}
                accessible={false}
              />
              <Text
                numberOfLines={2}
                style={[
                  styles.label,
                  { color, fontWeight: selected ? "700" : "500" },
                ]}
              >
                {item.label}
              </Text>
            </PlatformPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: BRAND.radius.pill,
  },
  indicator: {
    position: "absolute",
    top: DOCK.padding,
    bottom: DOCK.padding,
    left: DOCK.padding + 2,
    borderRadius: BRAND.radius.pill,
  },
  tab: {
    flex: 1,
    minHeight: BRAND.touchTarget,
    minWidth: BRAND.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: BRAND.radius.pill,
    overflow: "hidden",
  },
  label: { fontSize: 11, lineHeight: 14, textAlign: "center" },
});
