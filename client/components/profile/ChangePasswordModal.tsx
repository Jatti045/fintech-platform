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

import ModalCloseButton from "@/components/global/modalCloseButton";
import type { ChangePasswordModalProps } from "@/types/profile/types";

/**
 * Clean dark modal for changing the user's password.
 * Matches the minimal, premium design system.
 */
export default function ChangePasswordModal({
  THEME,
  visible,
  onClose,
  onSubmit,
  saving,
}: ChangePasswordModalProps) {
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
            backgroundColor: "#0B0B0D",
            padding: 18,
            position: "relative",
            borderTopLeftRadius: MODAL_BORDER_RADIUS,
            borderTopRightRadius: MODAL_BORDER_RADIUS,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#1F1F23",
          }}
        >
          <View className="relative mb-2">
            <ModalCloseButton setOpenSheet={handleClose} />
          </View>

          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text
              style={{
                color: "#FFFFFF",
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
                  color: "#8E8E93",
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
                placeholderTextColor="#636366"
                style={{
                  backgroundColor: "#101012",
                  borderColor: "#222226",
                  borderWidth: 1,
                  color: "#FFFFFF",
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
                  color: "#8E8E93",
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
                placeholderTextColor="#636366"
                style={{
                  backgroundColor: "#101012",
                  borderColor: "#222226",
                  borderWidth: 1,
                  color: "#FFFFFF",
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
                  color: "#8E8E93",
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
                placeholderTextColor="#636366"
                style={{
                  backgroundColor: "#101012",
                  borderColor: "#222226",
                  borderWidth: 1,
                  color: "#FFFFFF",
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
                  backgroundColor: saving ? "#262629" : "#D4AF6A",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#0B0B0D" />
                ) : (
                  <Text
                    style={{
                      color: "#0B0B0D",
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
