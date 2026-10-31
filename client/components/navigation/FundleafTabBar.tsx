import React, { useContext, useEffect, useState } from "react";
import { Keyboard, Platform, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions, useLinkBuilder } from "@react-navigation/native";
import { PlatformPressable } from "@react-navigation/elements";
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { FLOATING_TAB_BAR as DOCK, getFloatingTabBarHeight } from "@/constants/appConfig";

const tabs: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  index: { label: "Home", icon: "home-outline" },
  transaction: { label: "Transactions", icon: "swap-horizontal-outline" },
  budget: { label: "Budgets", icon: "wallet-outline" },
  profile: { label: "Profile", icon: "person-circle-outline" },
};
const transition = LinearTransition.duration(DOCK.animationDuration).reduceMotion(ReduceMotion.System);

/** Uses navigator state and native tab events, including preventDefault and reselect. */
export default function FundleafTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { THEME } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { buildHref } = useLinkBuilder();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const [keyboardShown, setKeyboardShown] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardShown(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const height = getFloatingTabBarHeight(fontScale);
  const reservedHeight = height + DOCK.gap * 2 + insets.bottom;
  useEffect(() => { reportHeight?.(keyboardShown ? 0 : reservedHeight); }, [keyboardShown, reportHeight, reservedHeight]);
  if (keyboardShown) return null;
  const innerWidth = Math.min(DOCK.maxWidth, width - insets.left - insets.right - DOCK.margin * 2) - DOCK.padding * 2 - 2;
  return <View testID="floating-tab-bar-space" style={{ paddingTop: DOCK.gap, paddingBottom: insets.bottom + DOCK.gap, paddingLeft: insets.left + DOCK.margin, paddingRight: insets.right + DOCK.margin, alignItems: "center", backgroundColor: THEME.background }}>
    <View accessibilityRole="tablist" accessibilityLabel="Main navigation" style={{ width: "100%", maxWidth: DOCK.maxWidth, height, padding: DOCK.padding, flexDirection: "row", alignItems: "stretch", borderRadius: 999, backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border, shadowColor: THEME.sheetBackdrop, shadowOffset: {width:0,height:4}, shadowOpacity:0.1, shadowRadius:12, elevation:4 }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = index === state.index;
        const item = tabs[route.name] || { label: route.name, icon: "ellipse-outline" as const };
        const label = typeof options.tabBarLabel === "string" ? options.tabBarLabel : options.title || item.label;
        const activeWidth = Math.max(BRAND.touchTarget, Math.min(46 + label.length * 6.5 * Math.min(fontScale, 2), innerWidth - BRAND.touchTarget * (state.routes.length - 1)));
        return <Animated.View key={route.key} layout={transition} style={{ flexGrow:1, flexBasis:0, minWidth:focused ? activeWidth : BRAND.touchTarget }}>
          <PlatformPressable href={buildHref(route.name, route.params)} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || label} accessibilityState={{selected:focused}} testID={options.tabBarButtonTestID}
            onPress={() => {
              const event = navigation.emit({type:"tabPress",target:route.key,canPreventDefault:true});
              if (!focused && !event.defaultPrevented) navigation.dispatch({...CommonActions.navigate(route),target:state.key});
            }}
            onLongPress={() => navigation.emit({type:"tabLongPress",target:route.key})}
            pressOpacity={0.85} pressColor={focused ? THEME.primaryHover : THEME.subtleSurface}
            style={{ flex:1, minHeight:BRAND.touchTarget, borderRadius:999, paddingHorizontal:6, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, overflow:"hidden", backgroundColor:focused ? THEME.primary : THEME.surface }}>
            <Ionicons name={item.icon} size={24} color={focused ? THEME.onPrimary : THEME.textSecondary} accessible={false}/>
            {focused ? <Text numberOfLines={2} maxFontSizeMultiplier={2} style={{ flexShrink:1, color:THEME.onPrimary, fontSize:13, lineHeight:17, fontWeight:"700", textAlign:"center" }}>{label}</Text> : null}
          </PlatformPressable>
        </Animated.View>;
      })}
    </View>
  </View>;
}
