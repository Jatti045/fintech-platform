import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalCloseButton from "../../global/modalCloseButton";
import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { validateResetPasswordForm } from "@/utils/validation";
import { LinearGradient } from "expo-linear-gradient";

export interface ResetPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  email: string;
  otp: string;
  /** Invoked with the new password pair; resolves `true` on success. */
  onSubmit: (
    newPassword: string,
    confirmPassword: string,
  ) => Promise<boolean>;
}

/**
 * Presentational "set new password" modal. Runs field-level validation and
 * forwards the submission to the parent — the parent owns the API call,
 * success/error alerts, and closing the recovery flow.
 */
function ResetPasswordModal({
  visible,
  onClose,
  email,
  otp,
  onSubmit,
}: ResetPasswordModalProps) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prev = useRef(visible);
  const modalHeight = getModalHeight();

  useEffect(() => {
    if (!visible && prev.current) {
      setNewPassword("");
      setConfirmPassword("");
    }
    prev.current = visible;
  }, [visible]);

  const confirmClose = () => {
    showAlert({
      title: "Discard changes?",
      message:
        "If you leave now the reset will be cancelled and you'll need to request a new code to reset your password.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: onClose },
      ],
    });
  };

  const handleSubmit = async () => {
    const check = validateResetPasswordForm(newPassword, confirmPassword);
    if (!check.valid) {
      showAlert({ title: check.message! });
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(newPassword, confirmPassword);
    } catch {
      // Failures are normally handled by the parent and reported through the
      // return value; this guard keeps the handler intentional.
      showAlert({ title: "Error", message: "Failed to reset password" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <SafeAreaView
          style={{
            height: modalHeight,
            backgroundColor: THEME.background,
            padding: 18,
            position: "relative",
            borderTopLeftRadius: MODAL_BORDER_RADIUS,
            borderTopRightRadius: MODAL_BORDER_RADIUS,
            overflow: "hidden",
            borderWidth: 1,
            borderTopColor: THEME.border,
          }}
        >
          <View className="relative mb-4">
            <ModalCloseButton setOpenSheet={() => confirmClose()} />
          </View>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, backgroundColor: THEME.background }}
          >
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
              <View className="flex-1 px-4">
                <Text
                  style={{ color: THEME.textPrimary }}
                  className="text-xl font-bold text-center mb-6"
                >
                  Set New Password
                </Text>

                <Text
                  style={{ color: THEME.textSecondary }}
                  className="mb-2 text-center"
                >
                  Enter your new password
                </Text>

                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  secureTextEntry
                  accessibilityLabel="New password"
                  placeholderTextColor={THEME.placeholderText}
                  style={{
                    backgroundColor: THEME.inputBackground,
                    color: THEME.textPrimary,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    marginVertical: 8,
                  }}
                />

                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  secureTextEntry
                  accessibilityLabel="Confirm password"
                  placeholderTextColor={THEME.placeholderText}
                  style={{
                    backgroundColor: THEME.inputBackground,
                    color: THEME.textPrimary,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    marginVertical: 8,
                  }}
                />

                <View className="mt-4">
                  <TouchableWithoutFeedback
                    onPress={isSubmitting ? undefined : handleSubmit}
                    accessibilityRole="button"
                    accessibilityLabel="Save New Password"
                    accessibilityState={{ disabled: isSubmitting }}
                  >
                    <View>
                      <LinearGradient
                        colors={[THEME.primary, THEME.secondary]}
                        start={[0, 0]}
                        end={[1, 1]}
                        style={{
                          paddingVertical: 12,
                          borderRadius: 8,
                          alignItems: "center",
                        }}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator
                            size="small"
                            color={THEME.textPrimary}
                          />
                        ) : (
                          <Text
                            style={{
                              color: THEME.textPrimary,
                              fontWeight: "700",
                            }}
                          >
                            Save New Password
                          </Text>
                        )}
                      </LinearGradient>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default ResetPasswordModal;

