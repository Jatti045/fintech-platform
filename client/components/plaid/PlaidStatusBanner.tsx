import {
  FLOATING_TAB_BAR,
  getFloatingTabBarHeight,
} from "@/constants/appConfig";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  PanResponder,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import BankAttentionCard from "./BankAttentionCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { fetchPlaidItems } from "@/store/slices/plaidSlice";
import { usePlaidHealth } from "@/hooks/plaid/usePlaidHealth";

const ALERT_SIZE = 64;
const EDGE_GAP = 12;
const DRAG_THRESHOLD = 8;

/** Monitors bank health and displays a floating shortcut to resolve alerts. */
export default function PlaidStatusBanner({ preview = false }: { preview?: boolean }) {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale, height, width } = useWindowDimensions();
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [corner, setCorner] = useState({ right: true, bottom: true });
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset] = useState(() => new Animated.ValueXY());
  const [morph] = useState(() => new Animated.Value(0));

  const overlayWidth = bounds.width || width;
  const overlayHeight = bounds.height || height;
  const left = insets.left + EDGE_GAP;
  const right = Math.max(left, overlayWidth - insets.right - EDGE_GAP - ALERT_SIZE);
  const top = insets.top + EDGE_GAP;
  const bottom = Math.max(top, overlayHeight - insets.bottom - getFloatingTabBarHeight(fontScale)
    - FLOATING_TAB_BAR.gap * 2 - ALERT_SIZE);
  const x = corner.right ? right : left;
  const y = corner.bottom ? bottom : top;

  const drag = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
      Math.hypot(dx, dy) >= DRAG_THRESHOLD,
    onPanResponderGrant: () => setDragging(true),
    onPanResponderMove: (_, { dx, dy }) => {
      offset.setValue({
        x: Math.min(right, Math.max(left, x + dx)) - x,
        y: Math.min(bottom, Math.max(top, y + dy)) - y,
      });
    },
    onPanResponderRelease: (_, { dx, dy }) => {
      setCorner({
        right: x + dx >= (left + right) / 2,
        bottom: y + dy >= (top + bottom) / 2,
      });
      offset.setValue({ x: 0, y: 0 });
      setDragging(false);
    },
    onPanResponderTerminate: () => {
      offset.setValue({ x: 0, y: 0 });
      setDragging(false);
    },
  }), [bottom, left, offset, right, top, x, y]);
  const {
    reauthItems,
    retryableItems,
    reauthingItemId,
    syncingItemIds,
    openReauth,
    retrySync,
  } = usePlaidHealth();

  const needsAttention = reauthItems.length > 0 || retryableItems.length > 0;
  const showPreview = __DEV__ && preview && !needsAttention;
  const visible = needsAttention || showPreview;

  // Fetch on launch + every time the app returns to the foreground.
  useEffect(() => {
    dispatch(fetchPlaidItems());
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        dispatch(fetchPlaidItems());
      }
    });
    return () => subscription.remove();
  }, [dispatch]);

  // Poll while anything needs attention so LOGIN_REPAIRED / successful manual
  // syncs are reflected without the user having to leave/reopen the app.
  useEffect(() => {
    if (reauthItems.length === 0 && retryableItems.length === 0) return;
    const interval = setInterval(() => dispatch(fetchPlaidItems()), 30_000);
    return () => clearInterval(interval);
  }, [dispatch, reauthItems.length, retryableItems.length]);

  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  const open = visible && expanded && !dragging;
  useEffect(() => {
    const animation = Animated.timing(morph, {
      toValue: open ? 1 : 0,
      duration: open ? 380 : 260,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [morph, open]);

  if (!visible) return null;

  const alerts = [
    ...reauthItems.map((item) => ({
      id: item.id,
      institutionName: item.institutionName,
      reconnect: true,
      busy: reauthingItemId === item.id,
      onPress: () => { void openReauth(item); },
    })),
    ...retryableItems.map((item) => ({
      id: item.id,
      institutionName: item.institutionName,
      reconnect: false,
      busy: syncingItemIds.includes(item.id),
      onPress: () => { void retrySync(item); },
    })),
  ];
  if (showPreview) {
    alerts.push({
      id: "preview",
      institutionName: "Demo Bank",
      reconnect: true,
      busy: false,
      onPress: () => Alert.alert("Plaid preview", "A real bank alert opens Plaid Link here."),
    });
  }
  const [firstAlert, ...otherAlerts] = alerts;
  const pillWidth = Math.min(320, right - left + ALERT_SIZE);
  const stretch = pillWidth - ALERT_SIZE;
  const inward = corner.right ? -1 : 1;
  const horizontalAnchor = corner.right ? { right: overlayWidth - right - ALERT_SIZE } : { left };
  const listOffset = corner.bottom ? overlayHeight - y + 8 : y + ALERT_SIZE + 8;

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
      onLayout={({ nativeEvent: { layout } }) => {
        setBounds({ width: layout.width, height: layout.height });
      }}
      testID="bank-attention-notification"
    >
      {open && otherAlerts.length > 0 && (
        <ScrollView
          style={[
            styles.bubble,
            horizontalAnchor,
            {
              width: pillWidth,
              maxHeight: Math.max(ALERT_SIZE, (bottom - top) / 2),
              ...(corner.bottom ? { bottom: listOffset } : { top: listOffset }),
            },
          ]}
          contentContainerStyle={styles.bubbleContent}
          keyboardShouldPersistTaps="handled"
        >
          {otherAlerts.map(({ id, ...alert }) => <BankAttentionCard key={id} {...alert} />)}
        </ScrollView>
      )}
      <Animated.View
        {...drag.panHandlers}
        style={[
          styles.pill,
          horizontalAnchor,
          {
            backgroundColor: THEME.primary,
            top: y,
            width: morph.interpolate({
              inputRange: [0, 0.16, 0.7, 1],
              outputRange: [ALERT_SIZE, ALERT_SIZE, pillWidth - stretch * 0.06, pillWidth],
            }),
            transform: [
              ...offset.getTranslateTransform(),
              { scaleY: morph.interpolate({
                inputRange: [0, 0.16, 0.62, 0.84, 1],
                outputRange: [1, 1.06, 0.92, 1.025, 1],
              }) },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
          style={[
            styles.pillContent,
            corner.right ? { right: ALERT_SIZE } : { left: ALERT_SIZE },
            {
              width: stretch,
              opacity: morph.interpolate({ inputRange: [0, 0.42, 0.88, 1], outputRange: [0, 0, 1, 1] }),
              transform: [{ translateX: morph.interpolate({
                inputRange: [0, 0.42, 1],
                outputRange: [-inward * 18, -inward * 18, 0],
              }) }],
            },
          ]}
        >
          {firstAlert && <BankAttentionCard {...firstAlert} inPill />}
        </Animated.View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Bank connection alerts"
          accessibilityState={{ expanded: open }}
          accessibilityHint="Opens or closes bank connection details"
          activeOpacity={0.8}
          onPress={() => setExpanded((value) => !value)}
          style={[styles.alertButton, corner.right ? { right: 0 } : { left: 0 }]}
        >
          <Animated.Text style={[
            styles.alertMark,
            {
              color: THEME.onPrimary,
              transform: [{ rotate: morph.interpolate({
                inputRange: [0, 0.2, 0.68, 1],
                outputRange: ["0deg", `${-inward * 12}deg`, `${inward * 5}deg`, "0deg"],
              }) }],
            },
          ]}>!</Animated.Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  bubble: {
    position: "absolute",
    flexGrow: 0,
    backgroundColor: "#122A22",
    borderColor: "#355447",
    borderWidth: 1,
    borderRadius: 16,
  },
  bubbleContent: { paddingHorizontal: 8, paddingVertical: 4 },
  pill: {
    position: "absolute",
    height: ALERT_SIZE,
    borderRadius: ALERT_SIZE / 2,
    overflow: "hidden",
  },
  pillContent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  alertButton: {
    position: "absolute",
    width: ALERT_SIZE,
    height: ALERT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  alertMark: { fontSize: 34, fontWeight: "800" },
});
