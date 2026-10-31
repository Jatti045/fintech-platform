import React, { createContext, useCallback, useEffect, useRef } from "react";
import {
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";

export const SheetInputContext = createContext(false);
const activeSheets: symbol[] = [];
function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return <View pointerEvents="none" style={style} />;
}

/** Controlled presentation; only a completed dismissal clears the owning form. */
export default function FundleafSheet({
  visible,
  onDismiss,
  title,
  children,
  dirty = false,
  busy = false,
  backdropDismiss = true,
}: {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: React.ReactNode;
  dirty?: boolean;
  busy?: boolean;
  backdropDismiss?: boolean;
}) {
  const { THEME } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheet = useRef<BottomSheetModal>(null);
  const id = useRef(Symbol("sheet"));
  const latest = useRef({ onDismiss, visible, busy, dirty });
  latest.current = { onDismiss, visible, busy, dirty };
  const requestClose = useCallback(() => {
    if (!latest.current.busy) latest.current.onDismiss();
  }, []);
  // Gorhom resets its internal status before onDismiss. Never dismiss it a
  // second time from visibility cleanup: that poisons the next presentation.
  const phase = useRef<"closed" | "presenting" | "open" | "closing">("closed");
  const mounted = useRef(true);
  const backSubscription = useRef<ReturnType<
    typeof BackHandler.addEventListener
  > | null>(null);
  const deactivate = useCallback(() => {
    backSubscription.current?.remove();
    backSubscription.current = null;
    const index = activeSheets.indexOf(id.current);
    if (index >= 0) activeSheets.splice(index, 1);
  }, []);
  const activate = useCallback(() => {
    if (backSubscription.current) return;
    const key = id.current;
    activeSheets.push(key);
    backSubscription.current = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (activeSheets[activeSheets.length - 1] !== key) return false;
        // Consume Back throughout the animation without closing an underlying
        // sheet or notifying an owner that already requested this close.
        if (phase.current !== "closing" || latest.current.visible)
          requestClose();
        return true;
      },
    );
  }, [requestClose]);
  const present = useCallback(() => {
    if (!mounted.current || phase.current !== "closed") return;
    phase.current = "presenting";
    activate();
    sheet.current?.present();
  }, [activate]);
  const dismiss = useCallback(() => {
    if (phase.current !== "open") return;
    phase.current = "closing";
    sheet.current?.dismiss();
  }, []);
  useEffect(() => {
    const modal = sheet.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      deactivate();
      const wasOpen = phase.current === "open";
      phase.current = "closed";
      if (wasOpen) modal?.dismiss();
    };
  }, [deactivate]);
  useEffect(() => {
    if (visible) present();
    else dismiss();
  }, [visible, present, dismiss]);
  const handleDismiss = useCallback(() => {
    if (!mounted.current || phase.current === "closed") return;
    const commanded = phase.current === "closing";
    deactivate();
    phase.current = "closed";
    if (!latest.current.visible) return;
    if (commanded) {
      // A new open intent arrived while the previous close was animating.
      present();
    } else {
      requestClose();
      // A late gesture must not bypass saving or unsaved-work protection.
      if (latest.current.busy || latest.current.dirty) present();
    }
  }, [deactivate, present, requestClose]);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="none"
        accessible={false}
        accessibilityRole="none"
        style={[props.style, { backgroundColor: THEME.sheetBackdrop }]}
      >
        {backdropDismiss ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${title} backdrop`}
            disabled={busy}
            activeOpacity={1}
            onPress={requestClose}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
        ) : null}
      </BottomSheetBackdrop>
    ),
    [THEME.sheetBackdrop, backdropDismiss, busy, requestClose, title],
  );
  const handle = useCallback(
    () => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Dismiss ${title}`}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={requestClose}
        onAccessibilityEscape={requestClose}
        style={{ height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <View
          accessible={false}
          style={{
            width: 38,
            height: 5,
            borderRadius: 3,
            backgroundColor: THEME.sheetHandle,
          }}
        />
      </TouchableOpacity>
    ),
    [THEME.sheetHandle, busy, requestClose, title],
  );
  return (
    <BottomSheetModal
      ref={sheet}
      accessible={false}
      accessibilityLabel={title}
      accessibilityRole="none"
      backgroundComponent={SheetBackground}
      stackBehavior="push"
      enableDynamicSizing
      maxDynamicContentSize={Math.max(200, height - insets.top - 24)}
      topInset={insets.top + 12}
      enablePanDownToClose={!dirty && !busy}
      enableHandlePanningGesture={!busy}
      enableContentPanningGesture={!busy}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableBlurKeyboardOnGesture={false}
      backdropComponent={backdrop}
      backgroundStyle={{
        backgroundColor: THEME.surface,
        borderTopLeftRadius: BRAND.radius.card,
        borderTopRightRadius: BRAND.radius.card,
      }}
      handleComponent={handle}
      onChange={(index) => {
        if (index >= 0 && phase.current === "presenting") {
          phase.current = "open";
          // present() mounts on the next animation frame. If visibility changed
          // during opening, wait until it exists before asking it to dismiss.
          if (!latest.current.visible) dismiss();
        }
      }}
      onDismiss={handleDismiss}
    >
      <SheetInputContext.Provider value>
        <BottomSheetScrollView
          accessibilityViewIsModal
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 20) + 12,
            gap: 16,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: THEME.textPrimary,
              fontSize: 24,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          {children}
        </BottomSheetScrollView>
      </SheetInputContext.Provider>
    </BottomSheetModal>
  );
}
