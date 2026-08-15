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
import ModalCloseButton from "../../global/modalCloseButton";
import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { LinearGradient } from "expo-linear-gradient";

export interface OTPModalProps {
  visible: boolean;
  onClose: () => void;
  email: string;
  /** Invoked with the entered code; resolves `true` when it was verified. */
  onVerify: (otp: string) => Promise<boolean>;
}

/**
 * Presentational OTP entry modal. Validates that a code was entered and
 * forwards verification to the parent — the parent owns the API call and
 * the step transition.
 */
function OTPModal({ visible, onClose, email, onVerify }: OTPModalProps) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [otp, setOtp] = useState("");
  const prev = useRef(visible);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalHeight = getModalHeight();

  useEffect(() => {
    if (!visible && prev.current) {
      setOtp("");
    }
    prev.current = visible;
  }, [visible]);

  const confirmClose = () => {
    showAlert({
      title: "Discard code?",
      message:
        "If you leave now the current code will be invalid and you'll need to request a new one.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: onClose },
      ],
    });
  };

  const handleSubmit = async () => {
    if (!otp.trim()) {
      showAlert({ title: "Please enter the code" });
      return;
    }

    try {
      setIsSubmitting(true);
      await onVerify(otp.trim());
    } catch {
      // Verification failures are normally handled by the parent and reported
      // through the return value; this guard keeps the handler intentional.
      showAlert({ title: "Invalid code", message: "Please try again" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal transparent={true} animationType="slide" visible={visible}>
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
                  Enter Code
                </Text>

                <Text
                  style={{ color: THEME.textSecondary }}
                  className="mb-2 text-center"
                >
                  Enter the 6-digit code sent to {email}
                </Text>

                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  keyboardType="number-pad"
                  accessibilityLabel="One-time code"
                  style={{
                    backgroundColor: THEME.inputBackground,
                    color: THEME.textPrimary,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    marginVertical: 12,
                    fontSize: 18,
                    textAlign: "center",
                  }}
                  placeholderTextColor={THEME.placeholderText}
                  maxLength={6}
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

export default OTPModal;

