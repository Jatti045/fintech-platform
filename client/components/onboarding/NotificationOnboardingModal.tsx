// ─── Notification Onboarding Modal ──────────────────────────────────────────
// A concise, optional prompt shown once after account creation. It explains
// the benefit of notifications and offers an explicit enable/decline choice.
// Declining is respected and the prompt never reappears.

import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";
import GlassPanel from "@/components/global/GlassPanel";

interface NotificationOnboardingModalProps {
  visible: boolean;
  onEnable: () => void;
  onDecline: () => void;
}

export default function NotificationOnboardingModal({
  visible,
  onEnable,
  onDecline,
}: NotificationOnboardingModalProps) {
  const { THEME } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: hexToRgba("#000000", 0.5),
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <GlassPanel padding={22} radius={24} style={{ width: "100%", maxWidth: 420 }}>
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: hexToRgba(THEME.primary, 0.16),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Feather name="bell" size={24} color={THEME.primary} />
            </View>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 20,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              Stay on top of your spending
            </Text>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 14,
                lineHeight: 20,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Enable notifications so we can remind you to log your purchases
              and keep your budget up to date.
            </Text>
          </View>

          <TouchableOpacity
            onPress={onEnable}
            style={{
              backgroundColor: THEME.primary,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 10,
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>
              Enable notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDecline}
            style={{ paddingVertical: 12, alignItems: "center" }}
            accessibilityRole="button"
          >
            <Text style={{ color: THEME.textSecondary, fontWeight: "600", fontSize: 14 }}>
              Not now
            </Text>
          </TouchableOpacity>
        </GlassPanel>
      </View>
    </Modal>
  );
}
