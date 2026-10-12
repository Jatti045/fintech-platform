import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import type { AiPrivacyPreference } from "@/api/aiPrivacy";

export default function AiPrivacyDisclosure({ visible, preference, saving, error, onCancel, onAccept }: {
  visible: boolean; preference?: AiPrivacyPreference; saving: boolean; error?: boolean; onCancel: () => void; onAccept: () => void;
}) {
  const { THEME } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View style={{ backgroundColor: THEME.surface, borderRadius: 20, padding: 22, maxHeight: "85%" }}>
          <Text style={{ color: THEME.textPrimary, fontSize: 19, fontWeight: "700", marginBottom: 14 }}>AI explanations and your privacy</Text>
          <ScrollView>
            <Text style={{ color: THEME.textSecondary, lineHeight: 21 }}>
              To explain your month, Budgee sends income and spending totals, category labels, budget usage, and recurring bill names and price changes to {preference?.providerName || "an external AI provider"}.
              {"\n\n"}Individual transaction records, stored account identifiers, bank credentials, and login tokens are excluded. Names or labels you entered may contain personal information.
              {"\n\n"}Retention and training rules depend on the configured provider. Budgee does not promise zero retention or exclusion from training.
              {"\n\n"}You choose when to generate an explanation. Enabling this preference does not generate one. You can disable future processing in Profile → AI privacy. Data already sent cannot be recalled.
            </Text>
            {preference?.privacyPolicyUrl && (
              <TouchableOpacity onPress={() => { void Linking.openURL(preference.privacyPolicyUrl!).catch(() => {}); }} accessibilityRole="link">
                <Text style={{ color: THEME.primary, marginTop: 12 }}>Read the provider privacy policy</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {error && <Text style={{ color: THEME.danger, marginTop: 12 }}>Could not confirm consent. Check your preference and try again.</Text>}
          <TouchableOpacity onPress={onAccept} disabled={saving || !preference} accessibilityRole="button" accessibilityLabel="Enable AI explanations"
            style={{ backgroundColor: THEME.primary, padding: 14, borderRadius: 12, marginTop: 20 }}>
            <Text style={{ color: THEME.background, textAlign: "center", fontWeight: "700" }}>{saving ? "Saving…" : "Enable AI explanations"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} disabled={saving} accessibilityRole="button" accessibilityLabel="Keep AI disabled" style={{ padding: 14 }}>
            <Text style={{ color: THEME.textPrimary, textAlign: "center" }}>Keep AI disabled</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
