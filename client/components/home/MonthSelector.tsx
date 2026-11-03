import React, { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import FundleafSheet from "@/components/sheets/FundleafSheet";
import MonthPicker, {
  type MonthPickerProps,
} from "@/components/calendar/MonthPicker";
import { monthIndex, monthLabels } from "@/components/calendar/months";

/** Home keeps its compact header; month interaction is shared with the other tabs. */
export default function MonthSelector({ value, onChange }: MonthPickerProps) {
  const { THEME } = useTheme();
  const [open, setOpen] = useState(false);
  const label = monthLabels(monthIndex(value));
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Select month, ${label.full}`}
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
          style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: "600" }}
        >
          {label.month} {label.year}
        </Text>
        <Feather name="chevron-down" size={16} color={THEME.textPrimary} />
      </TouchableOpacity>
      <FundleafSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        title="Reporting month"
      >
        <MonthPicker value={value} onChange={onChange} />
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
          <Text style={{ color: THEME.primary, fontWeight: "700" }}>Done</Text>
        </TouchableOpacity>
      </FundleafSheet>
    </>
  );
}
