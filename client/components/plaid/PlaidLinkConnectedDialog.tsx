import React from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";

interface PlaidLinkConnectedDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom-sheet-style dialog shown AFTER every successful bank link.
 *
 * Spec: the same message is shown each time a new bank is connected, not just
 * the first — "Your accounts are connected! Your transactions are now syncing
 * — this may take a moment. Pull down to refresh in a few seconds to see your
 * latest transactions."
 */
export default function PlaidLinkConnectedDialog({
  visible,
  onClose,
}: PlaidLinkConnectedDialogProps) {
  const { THEME } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: THEME.surface, borderColor: THEME.border },
          ]}
        >
          <View
            style={{
              alignSelf: "center",
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: hexToRgba(THEME.primary, 0.16),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark-circle" size={30} color={THEME.primary} />
          </View>

          <Text style={[styles.title, { color: THEME.textPrimary }]}>
            Your accounts are connected!
          </Text>
          <Text style={[styles.subtitle, { color: THEME.textSecondary }]}>
            Your transactions are now syncing — this may take a moment. Pull
            down to refresh in a few seconds to see your latest transactions.
          </Text>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Got it"
            style={[
              styles.button,
              { backgroundColor: THEME.primary, borderColor: THEME.primary },
            ]}
          >
            <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 8,
  },
  button: {
    marginTop: 18,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});