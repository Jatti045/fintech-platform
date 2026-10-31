import React, { PropsWithChildren } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";

export default function AuthScreen({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) {
  const { THEME } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: BRAND.spacing.lg,
            paddingVertical: BRAND.spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: BRAND.contentWidth,
              alignSelf: "center",
            }}
          >
            <View
              style={{ alignItems: "center", marginBottom: BRAND.spacing.xl }}
            >
              <Image
                source={require("@/assets/fundleaf-brand-assets/logo-mark.png")}
                style={{
                  width: 76,
                  height: 76,
                  marginBottom: BRAND.spacing.sm,
                }}
                resizeMode="contain"
                accessible={false}
              />
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 30,
                  fontWeight: "800",
                  letterSpacing: -1,
                }}
              >
                Fundleaf
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 14,
                  marginTop: BRAND.spacing.sm,
                  textAlign: "center",
                }}
              >
                Your money, your control.
              </Text>
            </View>
            <View
              style={{
                backgroundColor: THEME.surface,
                borderRadius: BRAND.radius.card,
                borderWidth: 1,
                borderColor: THEME.border,
                padding: BRAND.spacing.lg,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: THEME.textPrimary,
                  fontSize: 26,
                  fontWeight: "700",
                  letterSpacing: -0.6,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 15,
                  lineHeight: 23,
                  marginTop: BRAND.spacing.sm,
                  marginBottom: BRAND.spacing.lg,
                }}
              >
                {description}
              </Text>
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
