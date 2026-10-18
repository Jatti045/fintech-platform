import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  visible: boolean;
  month: number;
  year: number;
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TransactionDateFilter({
  visible,
  month,
  year,
  selectedDate,
  onSelect,
  onClose,
}: Props) {
  const { THEME } = useTheme();
  const label = new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + days) / 7) * 7;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.65)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <TouchableOpacity
          accessibilityLabel="Close date filter"
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 380,
            maxHeight: "90%",
            backgroundColor: THEME.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: THEME.border,
            padding: 20,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: THEME.textPrimary,
                  fontSize: 20,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                Filter by date
              </Text>
              <TouchableOpacity
                accessibilityLabel="Close calendar"
                accessibilityRole="button"
                onPress={onClose}
                style={{ padding: 10 }}
              >
                <Feather name="x" size={20} color={THEME.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: THEME.textSecondary, marginBottom: 20 }}>
              Select a day in {label}.
            </Text>
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {WEEKDAYS.map((day) => (
                <Text
                  key={day}
                  style={{
                    width: `${100 / 7}%`,
                    textAlign: "center",
                    color: THEME.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {day}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {Array.from({ length: cells }, (_, index) => {
                const day = index - offset + 1;
                if (day < 1 || day > days)
                  return (
                    <View
                      key={index}
                      style={{ width: `${100 / 7}%`, height: 44 }}
                    />
                  );
                const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const selected = selectedDate === date;
                return (
                  <TouchableOpacity
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={date}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onSelect(date);
                      onClose();
                    }}
                    style={{
                      width: `${100 / 7}%`,
                      minHeight: 44,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: selected ? 2 : 0,
                      borderColor: THEME.primary,
                      backgroundColor: selected
                        ? THEME.surfaceHover
                        : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: THEME.textPrimary,
                        fontSize: 15,
                        fontWeight: selected ? "700" : "500",
                      }}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              style={{
                padding: 14,
                marginTop: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: THEME.border,
              }}
            >
              <Text
                style={{
                  color: THEME.primary,
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Show all dates
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
