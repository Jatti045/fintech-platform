import { useTheme } from "@/hooks/useRedux";
import React, { useRef } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { BRAND } from "@/constants/ThemePalettes";
import { Feather } from "@expo/vector-icons";
import { hapticHeavy } from "@/utils/haptics";

export interface SwipeableRowProps {
  /** Content rendered inside the swipeable area. */
  children: React.ReactNode;
  /** Called when the delete action is triggered (swipe or long-press). */
  onDelete: () => void;
  /** Background colour of the delete button. */
  dangerColor: string;
  /** Extra styles applied to the delete-action container. */
  actionStyle?: ViewStyle;
}

/**
 * Reusable swipe-right-to-reveal-delete wrapper.
 *
 * Renders a red trash-icon button when the user swipes left.
 * Triggers haptic feedback on press.
 */
export default function SwipeableRow({
  children,
  onDelete,
  dangerColor,
  actionStyle,
}: SwipeableRowProps) {
  const { THEME } = useTheme();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={[
          styles.deleteAction,
          { backgroundColor: dangerColor },
          actionStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Delete item"
        activeOpacity={0.7}
        onPress={() => {
          hapticHeavy();
          swipeableRef.current?.close();
          onDelete();
        }}
      >
        <View accessible={false}>
          <Feather name="trash-2" size={22} color={THEME.onDanger} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={1.35}
      rightThreshold={40}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: BRAND.radius.input,
    marginBottom: 0,
    marginLeft: 8,
  },
});
