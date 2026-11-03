import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import FundleafSheet from "@/components/sheets/FundleafSheet";
import { BRAND } from "@/constants/ThemePalettes";

type Props = {
  compact?: boolean;
  monthLabel: string;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
};
export default function MonthSelector({
  compact = false,
  monthLabel,
  isCurrentMonth,
  onPrev,
  onNext,
}: Props) {
  const { THEME } = useTheme();
  const [open, setOpen] = useState(false);
  if (compact) {
    const shortLabel = monthLabel.replace(
      /^(\S+) /,
      (_, month: string) => `${month.slice(0, 3)} `,
    );
    return (
      <>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Select month, ${monthLabel}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 24,
            backgroundColor: THEME.subtleSurface,
          }}
        >
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {shortLabel}
          </Text>
          <Feather name="chevron-down" size={16} color={THEME.textPrimary} />
        </TouchableOpacity>
        <FundleafSheet
          visible={open}
          onDismiss={() => setOpen(false)}
          title="Reporting month"
        >
          <MonthSelector
            monthLabel={monthLabel}
            isCurrentMonth={isCurrentMonth}
            onPrev={onPrev}
            onNext={onNext}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Done selecting month"
            onPress={() => setOpen(false)}
            style={{
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: THEME.primary, fontWeight: "700" }}>
              Done
            </Text>
          </TouchableOpacity>
        </FundleafSheet>
      </>
    );
  }
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: BRAND.radius.input,
        marginBottom: BRAND.spacing.md,
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={onPrev}
        style={{
          width: BRAND.touchTarget,
          minHeight: BRAND.touchTarget,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="chevron-left" size={20} color={THEME.textPrimary} />
      </TouchableOpacity>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          paddingVertical: BRAND.spacing.sm,
        }}
      >
        <Text
          style={{
            color: THEME.textPrimary,
            textAlign: "center",
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {monthLabel}
        </Text>
        <Text
          style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}
        >
          {isCurrentMonth ? "This month" : "Reporting period"}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: isCurrentMonth }}
        disabled={isCurrentMonth}
        onPress={onNext}
        style={{
          width: BRAND.touchTarget,
          minHeight: BRAND.touchTarget,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather
          name="chevron-right"
          size={20}
          color={isCurrentMonth ? THEME.textDisabled : THEME.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}
