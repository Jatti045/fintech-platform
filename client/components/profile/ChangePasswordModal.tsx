import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useRedux";
import ModalCloseButton from "@/components/global/modalCloseButton";
import type { ChangePasswordModalProps } from "@/types/profile/types";

/**
 * Clean modal for changing the user's password.
 * Matches the minimal, premium design system.
 */
export default function ChangePasswordModal({
  THEME: propTheme,
  visible,
  onClose,
  onSubmit,
  saving,
}: ChangePasswordModalProps) {
  const { selectedTheme, THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;
  const ctaTextColor = selectedTheme === "Light" ? "#FFFFFF" : "#0B0B0D";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  const handleSubmit = async () => {
    await onSubmit(currentPassword, newPassword, confirmPassword);
  };

  if (!visible) return null;

  const modalHeight = getModalHeight();

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
        }}
      >
        <SafeAreaView
          style={{
            height: modalHeight,
            backgroundColor: theme.background,
            padding: 18,
            position: "relative",
            borderTopLeftRadius: MODAL_BORDER_RADIUS,
            borderTopRightRadius: MODAL_BORDER_RADIUS,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View className="relative mb-2">
            <ModalCloseButton setOpenSheet={handleClose} />
          </View>

          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text
              style={{
                color: theme.textPrimary,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Change Password
            </Text>
          </View>

          <ScrollView
            style={{ marginTop: 18 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Current */}
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 13,
                  fontWeight: "500",
                  marginBottom: 6,
                }}
              >
                Current Password
              </Text>
              <TextInput
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor={theme.placeholderText}
                style={{
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  borderWidth: 1,
                  color: theme.textPrimary,
                  padding: 13,
                  borderRadius: 12,
                  fontSize: 15,
                }}
              />
            </View>

            {/* New */}
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 13,
                  fontWeight: "500",
                  marginBottom: 6,
                }}
              >
                New Password
              </Text>
              <TextInput
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor={theme.placeholderText}
                style={{
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  borderWidth: 1,
                  color: theme.textPrimary,
                  padding: 13,
                  borderRadius: 12,
                  fontSize: 15,
                }}
              />
            </View>

            {/* Confirm */}
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 13,
                  fontWeight: "500",
                  marginBottom: 6,
                }}
              >
                Confirm New Password
              </Text>
              <TextInput
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={theme.placeholderText}
                style={{
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  borderWidth: 1,
                  color: theme.textPrimary,
                  padding: 13,
                  borderRadius: 12,
                  fontSize: 15,
                }}
              />
            </View>

            {/* Submit */}
            <View style={{ marginTop: 6 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={saving}
                style={{
                  backgroundColor: saving ? theme.surfaceHover : theme.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                {saving ? (
                  <ActivityIndicator color={ctaTextColor} />
                ) : (
                  <Text
                    style={{
                      color: ctaTextColor,
                      fontWeight: "800",
                      fontSize: 15,
                    }}
                  >
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
