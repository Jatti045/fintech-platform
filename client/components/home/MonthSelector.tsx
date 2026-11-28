import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import FundleafSheet from "@/components/sheets/FundleafSheet";
import MonthPicker, {
  type MonthPickerProps,
} from "@/components/calendar/MonthPicker";
import {
  currentMonthIndex,
  monthAt,
  monthIndex,
  monthLabels,
} from "@/components/calendar/months";
import { hapticSelection } from "@/utils/haptics";

export default function MonthSelector({ value, onChange }: MonthPickerProps) {
  const { THEME } = useTheme();
  const [open, setOpen] = useState(false);
  const index = monthIndex(value);
  const latest = currentMonthIndex();
  const label = monthLabels(index);
  const change = (next: number) => {
    if (next === index || next > latest) return;
    hapticSelection();
    onChange(monthAt(next));
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Select month, ${label.full}`}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={[
          styles.trigger,
          { borderColor: THEME.border, backgroundColor: THEME.surface },
        ]}
      >
        <Feather name="calendar" size={16} color={THEME.primary} />
        <Text
          style={[
            TYPE.caption,
            { color: THEME.textPrimary, fontWeight: "600", flexShrink: 1 },
          ]}
        >
          {label.month} {label.year}
        </Text>
        <Feather name="chevron-down" size={15} color={THEME.textSecondary} />
      </TouchableOpacity>
      <FundleafSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        title="Reporting month"
      >
        <View style={styles.sheetControls}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => change(index - 1)}
            style={[styles.arrow, { backgroundColor: THEME.subtleSurface }]}
          >
            <Feather name="chevron-left" size={22} color={THEME.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <MonthPicker
              value={value}
              onChange={(period) => change(monthIndex(period))}
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={index >= latest}
            accessibilityState={{ disabled: index >= latest }}
            onPress={() => change(index + 1)}
            style={[styles.arrow, { backgroundColor: THEME.subtleSurface }]}
          >
            <Feather
              name="chevron-right"
              size={22}
              color={index >= latest ? THEME.textDisabled : THEME.textPrimary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.sheetActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go to current month"
            disabled={index === latest}
            onPress={() => change(latest)}
            style={styles.action}
          >
            <Text
              style={[
                TYPE.label,
                {
                  color: index === latest ? THEME.textDisabled : THEME.primary,
                },
              ]}
            >
              Current month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Done selecting month"
            onPress={() => setOpen(false)}
            style={[styles.action, { backgroundColor: THEME.primary }]}
          >
            <Text style={[TYPE.label, { color: THEME.onPrimary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </FundleafSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: BRAND.touchTarget,
    borderRadius: BRAND.radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  sheetControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: BRAND.spacing.xs,
  },
  arrow: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: BRAND.spacing.sm,
  },
  action: {
    minHeight: BRAND.touchTarget,
    justifyContent: "center",
    paddingHorizontal: BRAND.spacing.md,
    borderRadius: BRAND.radius.button,
  },
});
