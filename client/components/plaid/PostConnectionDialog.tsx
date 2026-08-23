import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import type { IPlaidItem } from "@/types/plaid/types";

/**
 * Post-connection confirmation dialog.
 *
 * Shown every time the user successfully links a new bank through Plaid Link
 * (not just the first time). Surfaces the bank name so the message feels
 * specific, and tells the user transactions are syncing in the background with
 * a gentle prompt to pull-to-refresh.
 *
 * The dialog is non-dismissible (no backdrop tap or hardware back close) so the
 * user must actively acknowledge it, preventing a silent "did that work?" moment.
 */
export default function PostConnectionDialog({
  visible,
  item,
  onDismiss,
}: PostConnectionDialogProps) {
  const { THEME } = useTheme();
  const bankName = item?.institutionName || "your bank";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      hardwareAccelerated
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: "100%",
            backgroundColor: THEME.surface,
            borderRadius: 20,
            paddingHorizontal: 24,
            paddingVertical: 28,
            alignItems: "center",
          }}
        >
          {/* Success icon circle */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "rgba(76, 175, 80, 0.12)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 28 }}>&#9989;</Text>
          </View>

          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Your accounts are connected!
          </Text>

          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 14,
              lineHeight: 20,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Your transactions from {bankName} are now syncing — this may take a
            moment. Pull down to refresh in a few seconds to see your latest
            transactions.
          </Text>

          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Got it"
            style={{
              width: "100%",
              backgroundColor: THEME.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Got it
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface PostConnectionDialogProps {
  visible: boolean;
  item: IPlaidItem | null;
  onDismiss: () => void;
}
