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
  const latest = useRef({ onDismiss, visible, busy });
  latest.current = { onDismiss, visible, busy };
  const requestClose = useCallback(() => {
    if (!latest.current.busy) latest.current.onDismiss();
  }, []);
  useEffect(() => {
    const key = id.current;
    const modal = sheet.current;
    latest.current.visible = visible;
    // Never dismiss an unpresented modal: Gorhom treats that as a closing transition.
    if (!visible) return;
    activeSheets.push(key);
    modal?.present();
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeSheets[activeSheets.length - 1] !== key) return false;
      requestClose();
      return true;
    });
    return () => {
      // Late animation callbacks must not prompt or update an unmounted owner.
      latest.current.visible = false;
      back.remove();
      const index = activeSheets.indexOf(key);
      if (index >= 0) activeSheets.splice(index, 1);
      modal?.dismiss();
    };
  }, [visible, requestClose]);
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
      onDismiss={() => {
        if (latest.current.visible && !latest.current.busy) requestClose();
      }}
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
