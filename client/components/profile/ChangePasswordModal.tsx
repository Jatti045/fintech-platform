import React, { useState } from "react";
import {
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import BrandInput from "@/components/brand/BrandInput";
import BrandButton from "@/components/brand/BrandButton";
import type { ChangePasswordModalProps } from "@/types/profile/types";

export default function ChangePasswordModal({
  THEME: propTheme,
  visible,
  onClose,
  onSubmit,
  saving,
}: ChangePasswordModalProps) {
  const { THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const handleClose = () => {
    if (saving) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };
  if (!visible) return null;
  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: BRAND.overlay,
        }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            maxHeight: "95%",
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            backgroundColor: theme.background,
            borderTopLeftRadius: BRAND.radius.card,
            borderTopRightRadius: BRAND.radius.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 16 }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: theme.textPrimary,
                fontSize: 24,
                fontWeight: "800",
              }}
            >
              Change Password
            </Text>
            <Text style={{ color: theme.textSecondary }}>
              Keep your Fundleaf account secure.
            </Text>
            <BrandInput
              label="Current Password"
              placeholder="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              password
              autoComplete="current-password"
              editable={!saving}
            />
            <BrandInput
              label="New Password"
              placeholder="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              password
              autoComplete="new-password"
              editable={!saving}
            />
            <BrandInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              password
              autoComplete="new-password"
              editable={!saving}
            />
            <BrandButton
              label="Update Password"
              loading={saving}
              loadingLabel="Updating password…"
              onPress={() => {
                if (!saving)
                  void onSubmit(currentPassword, newPassword, confirmPassword);
              }}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel password change"
              disabled={saving}
              onPress={handleClose}
              style={{
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: theme.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
