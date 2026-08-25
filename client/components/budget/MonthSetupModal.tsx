import React from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import ModalCloseButton from "../global/modalCloseButton";
import { getCurrencySymbol } from "@/constants/Currencies";
import Loader from "@/utils/loader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMonthSetup } from "@/hooks/budget/useMonthSetup";
import { hexToRgba } from "@/utils/helper";
import type { EditableSuggestion } from "@/hooks/budget/useMonthSetup";

export interface MonthSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  currencyCode: string;
  /** Optional label shown in the header, e.g. "August". */
  monthLabel?: string;
}

/**
 * Smart Month Setup bottom sheet — a single reusable flow for configuring a
 * month from suggested budgets. Consumed by the Budget screen's empty +
 * unbudgeted states and by the Home screen's no-budget guard. The user edits
 * limits, toggles categories, and confirms once before anything is applied.
 */
export default function MonthSetupModal({
  open,
  onOpenChange,
  month,
  year,
  currencyCode,
  monthLabel,
}: MonthSetupModalProps) {
  const { THEME } = useTheme();
  const currencySymbol = getCurrencySymbol((currencyCode || "USD").toUpperCase());

  const {
    edits,
    isLoading,
    error,
    isEmpty,
    applying,
    selectedCount,
    allSelected,
    refetch,
    setLimit,
    toggleSelected,
    setAllSelected,
    apply,
  } = useMonthSetup({ month, year, open, onOpenChange, currencyCode });

  const modalHeight = getModalHeight();

  return (
    <Modal visible={open} animationType="slide" transparent={true}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <SafeAreaView
          style={{
            height: modalHeight,
            backgroundColor: THEME.background,
            padding: 18,
            position: "relative",
            borderTopLeftRadius: MODAL_BORDER_RADIUS,
            borderTopRightRadius: MODAL_BORDER_RADIUS,
            overflow: "hidden",
            borderWidth: 1,
            borderTopColor: THEME.border,
          }}
        >
          <View className="relative mb-4">
            <ModalCloseButton setOpenSheet={onOpenChange} />
          </View>

          <View className="items-center justify-center relative mb-4">
            <Text
              style={{ color: THEME.textPrimary }}
              className="text-lg text-center font-bold"
            >
              Set up {monthLabel ? `${monthLabel} ` : ""}like your last month?
            </Text>
            <Text
              style={{ color: THEME.textSecondary, marginTop: 4 }}
              className="text-sm text-center"
            >
              Review the suggestions below, then confirm to apply them at once.
            </Text>
          </View>

          {isLoading ? (
            <View style={{ flex: 1 }}>
              <Loader msg="Finding suggestions..." />
            </View>
          ) : error ? (
            <View style={{ flex: 1, alignItems: "center", paddingTop: 32 }}>
              <Text style={{ color: THEME.textSecondary, textAlign: "center" }}>
                                We couldn&apos;t load suggestions right now.
              </Text>
              <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 16 }}>
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
                >
                  <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                    Try again
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : isEmpty ? (
            <View style={{ flex: 1, alignItems: "center", paddingTop: 32 }}>
              <Text style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "700" }}>
                No suggestions yet
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  textAlign: "center",
                  marginTop: 6,
                  maxWidth: 280,
                  lineHeight: 19,
                }}
              >
                                We need more history to suggest budgets you haven&apos;t set before.
                Create your first budget and we&apos;ll take it from there.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                    {selectedCount} of {edits.length} selected
                  </Text>
                  <TouchableOpacity onPress={() => setAllSelected(!allSelected)}>
                    <Text
                      style={{ color: THEME.primary, fontSize: 13, fontWeight: "700" }}
                    >
                      {allSelected ? "Deselect all" : "Select all"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {edits.map((s) => (
                  <SuggestionRow
                    key={s.category}
                    suggestion={s}
                    currencySymbol={currencySymbol}
                    onToggle={() => toggleSelected(s.category)}
                    onLimitChange={(v) => setLimit(s.category, v)}
                  />
                ))}
                <View style={{ height: 12 }} />
              </ScrollView>

              <View style={{ marginTop: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={apply}
                  disabled={applying || selectedCount === 0}
                >
                  <LinearGradient
                    colors={[THEME.primary, THEME.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: 14,
                      borderRadius: 10,
                      alignItems: "center",
                      opacity: selectedCount === 0 ? 0.4 : 1,
                    }}
                  >
                    <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                      {applying
                        ? "Applying..."
                        : `Apply ${selectedCount} budget${selectedCount === 1 ? "" : "s"}`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SuggestionRow({
  suggestion,
  currencySymbol,
  onToggle,
  onLimitChange,
}: {
  suggestion: EditableSuggestion;
  currencySymbol: string;
  onToggle: () => void;
  onLimitChange: (value: string) => void;
}) {
  const { THEME } = useTheme();

  const subtitle = suggestionSubtitle(suggestion);
  const spendingLine =
    suggestion.autoCreated || suggestion.spentToDate > 0
      ? ` • ${currencySymbol}${Number.isFinite(suggestion.spentToDate) ? suggestion.spentToDate.toFixed(2) : "0.00"} spent so far`
      : "";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: hexToRgba(THEME.border, 0.6),
        gap: 10,
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityLabel={`Select ${suggestion.category}`}
      >
        <Feather
          name={suggestion.selected ? "check-circle" : "circle"}
          size={22}
          color={suggestion.selected ? THEME.primary : THEME.textSecondary}
        />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text
          style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: "700" }}
          numberOfLines={1}
        >
          {suggestion.category}
        </Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 1 }}>
          {subtitle}
          {spendingLine}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: THEME.inputBackground,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: THEME.border,
          paddingHorizontal: 8,
          width: 108,
        }}
      >
        <Text style={{ color: THEME.textSecondary, fontWeight: "600" }}>
          {currencySymbol}
        </Text>
        <TextInput
          value={suggestion.limitInput}
          onChangeText={onLimitChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={THEME.placeholderText}
          accessibilityLabel={`${suggestion.category} suggested limit`}
          style={{ color: THEME.textPrimary, flex: 1, paddingVertical: 8, paddingLeft: 6 }}
        />
      </View>
    </View>
  );
}

/** Human-readable source label for a suggestion row. */
function suggestionSubtitle(suggestion: EditableSuggestion): string {
  if (suggestion.inherited) {
    return "From your last month's budget";
  }
  const months = suggestion.monthsSampled;
  return months > 0
    ? `Based on ${months} month${months === 1 ? "" : "s"} of recent spending`
    : "Based on recent spending";
}
