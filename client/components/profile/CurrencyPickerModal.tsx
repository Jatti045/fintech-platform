import React from "react";
import { View, Text, TouchableOpacity, FlatList, Modal } from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/constants/Currencies";
import type { CurrencyPickerModalProps } from "@/types/profile/types";

/**
 * Bottom-sheet style modal for selecting the default currency.
 * Minimal, theme-aware, restrained design.
 */
export default function CurrencyPickerModal({
  visible,
  userCurrency,
  onSelect,
  onClose,
}: CurrencyPickerModalProps) {
  const { THEME } = useTheme();

  if (!visible) return null;

  const modalHeight = getModalHeight();

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: THEME.surface,
            borderTopLeftRadius: MODAL_BORDER_RADIUS,
            borderTopRightRadius: MODAL_BORDER_RADIUS,
            height: modalHeight,
            paddingBottom: 30,
            borderWidth: 1,
            borderColor: THEME.border,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: THEME.border,
            }}
          >
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              Select Default Currency
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={CURRENCIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected =
                item.code === (userCurrency || DEFAULT_CURRENCY);
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.code)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    backgroundColor: isSelected
                      ? hexToRgba(THEME.primary, 0.1)
                      : "transparent",
                    borderBottomWidth: 0.5,
                    borderBottomColor: THEME.border,
                  }}
                >
                  <Text style={{ fontSize: 22, marginRight: 14 }}>
                    {item.flag}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: THEME.textPrimary,
                        fontWeight: isSelected ? "700" : "500",
                        fontSize: 15,
                      }}
                    >
                      {item.code}{" "}
                      <Text
                        style={{
                          color: THEME.textSecondary,
                          fontWeight: "400",
                        }}
                      >
                        — {item.name}
                      </Text>
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: THEME.textSecondary,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    {item.symbol}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={THEME.primary}
                      style={{ marginLeft: 10 }}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
