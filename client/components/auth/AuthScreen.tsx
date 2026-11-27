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
import { BRAND, TYPE } from "@/constants/ThemePalettes";
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BRAND.spacing.sm,
                marginBottom: BRAND.spacing.xl,
              }}
            >
              <Image
                source={require("@/assets/fundleaf-brand-assets/logo-mark.png")}
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
                accessible={false}
              />
              <Text style={[TYPE.section, { color: THEME.textPrimary }]}>
                Fundleaf
              </Text>
            </View>
            <View>
              <Text
                accessibilityRole="header"
                style={[TYPE.screen, { color: THEME.textPrimary }]}
              >
                {title}
              </Text>
              {description ? (
                <Text
                  style={[
                    TYPE.body,
                    {
                      color: THEME.textSecondary,
                      marginTop: BRAND.spacing.sm,
                      marginBottom: BRAND.spacing.lg,
                    },
                  ]}
                >
                  {description}
                </Text>
              ) : null}
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
