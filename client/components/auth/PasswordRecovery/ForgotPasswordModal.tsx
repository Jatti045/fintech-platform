import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { validateEmail } from "@/utils/validation";
import ModalCloseButton from "../../global/modalCloseButton";

export interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  /** Invoked with the trimmed email; the parent decides the next step. */
  onSubmit: (email: string) => Promise<boolean> | boolean;
}

/**
 * Presentational "forgot password" modal. Collects the account email, runs
 * field-level validation, and forwards the submission to the parent — it does
 * not dispatch API calls or manage the recovery workflow.
 */
function ForgotPasswordModal({
  visible,
  onClose,
  onSubmit,
}: ForgotPasswordModalProps) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevOpen = useRef(visible);
  const modalHeight = getModalHeight();

  useEffect(() => {
    if (!visible && prevOpen.current) {
      setEmail("");
    }
    prevOpen.current = visible;
  }, [visible]);

  const handleSubmit = async () => {
    const check = validateEmail(email);
    if (!check.valid) {
      showAlert({ title: check.message! });
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(email.trim());
      // The parent moves the workflow forward; this modal unmounts.
    } catch (err: unknown) {
      showAlert({
        title: "Error",
        message: err instanceof Error ? err.message : "Failed to submit",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} transparent={true}>
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
            <ModalCloseButton setOpenSheet={() => onClose()} />
          </View>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, backgroundColor: THEME.background }}
          >
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
              <View className="flex-1 px-4 ">
                <Text
                  style={{ color: THEME.textPrimary }}
                  className="text-xl  font-bold text-center mb-6"
                >
                  Forgot Password
                </Text>

                <Text style={{ color: THEME.textSecondary }} className="mb-2">
                  Enter the email associated with your account
                </Text>

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={THEME.placeholderText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Email address"
                  style={{
                    backgroundColor: THEME.inputBackground,
                    color: THEME.textPrimary,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    marginBottom: 8,
                  }}
                />

                <View className="mt-6">
                  <TouchableOpacity
                    onPress={isSubmitting ? undefined : handleSubmit}
                    activeOpacity={0.85}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Send OTP"
                    accessibilityState={{ disabled: isSubmitting }}
                    style={{ opacity: isSubmitting ? 0.6 : 1 }}
                  >
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
                          Send OTP
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default ForgotPasswordModal;
