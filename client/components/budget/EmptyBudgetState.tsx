import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import BrandButton from "@/components/brand/BrandButton";

const EmptyBudgetState = React.memo(function EmptyBudgetState({
  onSetup,
}: {
  onSetup?: () => void;
}) {
  const { THEME } = useTheme();
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderColor: THEME.border,
        borderWidth: 1,
        borderRadius: BRAND.radius.card,
        padding: BRAND.spacing.lg,
        gap: BRAND.spacing.md,
        marginTop: BRAND.spacing.md,
      }}
    >
      <Feather name="pie-chart" size={28} color={THEME.primary} />
      <Text
        accessibilityRole="header"
        style={{ color: THEME.textPrimary, fontSize: 22, fontWeight: "700" }}
      >
        No budgets yet
      </Text>
      <Text
        style={{ color: THEME.textSecondary, fontSize: 14, lineHeight: 22 }}
      >
        Review prior limits and suggested categories in Smart Month Setup, or
        create budgets one by one.
      </Text>
      {onSetup ? (
        <BrandButton label="Set up my month" onPress={onSetup} />
      ) : (
        <Text style={{ color: THEME.textSecondary }}>
          Tap “New Budget” to get started.
        </Text>
      )}
    </View>
  );
});
export default EmptyBudgetState;
