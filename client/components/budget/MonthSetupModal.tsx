import FundleafSheet from "@/components/sheets/FundleafSheet";
import { useSheetDismiss } from "@/components/sheets/useSheetDismiss";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import {
  useMonthSetup,
  type EditableSuggestion,
} from "@/hooks/budget/useMonthSetup";
import { BRAND } from "@/constants/ThemePalettes";
import BrandInput from "@/components/brand/BrandInput";
import BrandButton from "@/components/brand/BrandButton";
import { formatCurrency } from "@/utils/helper";

export interface MonthSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  currencyCode: string;
  monthLabel?: string;
}
export default function MonthSetupModal({
  open,
  onOpenChange,
  month,
  year,
  currencyCode,
  monthLabel,
}: MonthSetupModalProps) {
  const { THEME } = useTheme();
  const {
    suggestions,
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
  const dirty = edits.some(
    (e) =>
      !e.selected ||
      e.limitInput !==
        String(
          suggestions?.find((s) => s.category === e.category)?.suggestedLimit ??
            e.limitInput,
        ),
  );
  const close = useSheetDismiss(() => onOpenChange(false), dirty, applying);
  const period = monthLabel
    ? monthLabel.includes(String(year))
      ? monthLabel
      : `${monthLabel} ${year}`
    : new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
  return (
    <FundleafSheet
      visible={open}
      onDismiss={close}
      title="Smart Month Setup"
      dirty={dirty}
      busy={applying}
    >
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 14,
          lineHeight: 21,
          marginVertical: BRAND.spacing.sm,
        }}
      >
        Plan {period}. Review prior limits and spending suggestions, then apply
        your selection.
      </Text>
      {isLoading ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ padding: BRAND.spacing.lg, gap: BRAND.spacing.md }}
        >
          <ActivityIndicator color={THEME.primary} />
          <Text style={{ color: THEME.textSecondary }}>
            Finding suggestions...
          </Text>
        </View>
      ) : error ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            paddingVertical: BRAND.spacing.lg,
            gap: BRAND.spacing.md,
          }}
        >
          <Text style={{ color: THEME.danger, fontSize: 15 }}>
            We couldn&apos;t load suggestions right now.
          </Text>
          <BrandButton
            label="Try again"
            onPress={() => {
              void refetch();
            }}
          />
        </View>
      ) : isEmpty ? (
        <View
          style={{
            paddingVertical: BRAND.spacing.lg,
            gap: BRAND.spacing.sm,
          }}
        >
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            No suggestions yet
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 14,
              lineHeight: 22,
            }}
          >
            There are no new suggestions for this month. Categories with manual
            limits are left unchanged. You can create a budget or return after
            more spending history is available.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: BRAND.spacing.sm,
            }}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: THEME.textSecondary, fontSize: 13 }}
            >
              {selectedCount} of {edits.length} selected
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={allSelected ? "Deselect all" : "Select all"}
              disabled={applying}
              onPress={() => setAllSelected(!allSelected)}
              style={{
                minHeight: BRAND.touchTarget,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: THEME.primary, fontWeight: "600" }}>
                {allSelected ? "Deselect all" : "Select all"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: BRAND.spacing.md }}>
            {edits.map((s) => (
              <SuggestionRow
                key={s.category}
                suggestion={s}
                currencyCode={currencyCode}
                disabled={applying}
                onToggle={() => toggleSelected(s.category)}
                onLimitChange={(v) => setLimit(s.category, v)}
              />
            ))}
          </View>
          <View style={{ paddingTop: BRAND.spacing.sm }}>
            <BrandButton
              label={`Apply ${selectedCount} budget${selectedCount === 1 ? "" : "s"}`}
              loading={applying}
              loadingLabel="Applying..."
              disabled={selectedCount === 0}
              onPress={() => {
                void apply();
              }}
            />
          </View>
        </>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancel month setup"
        disabled={applying}
        onPress={close}
        style={{
          minHeight: BRAND.touchTarget,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: THEME.primary, fontWeight: "600" }}>Cancel</Text>
      </TouchableOpacity>
    </FundleafSheet>
  );
}
function SuggestionRow({
  suggestion,
  currencyCode,
  disabled,
  onToggle,
  onLimitChange,
}: {
  suggestion: EditableSuggestion;
  currencyCode: string;
  disabled: boolean;
  onToggle: () => void;
  onLimitChange: (value: string) => void;
}) {
  const { THEME } = useTheme();
  const subtitle = suggestion.inherited
    ? "From your last month's budget"
    : suggestion.monthsSampled > 0
      ? `Based on ${suggestion.monthsSampled} month${suggestion.monthsSampled === 1 ? "" : "s"} of recent spending`
      : "Based on recent spending";
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: BRAND.radius.card,
        borderWidth: 1,
        borderColor: THEME.border,
        padding: BRAND.spacing.md,
        gap: BRAND.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: BRAND.spacing.sm,
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityLabel={`Select ${suggestion.category}`}
          accessibilityState={{ checked: suggestion.selected, disabled }}
          disabled={disabled}
          onPress={onToggle}
          style={{
            width: BRAND.touchTarget,
            height: BRAND.touchTarget,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather
            name={suggestion.selected ? "check-square" : "square"}
            size={22}
            color={suggestion.selected ? THEME.primary : THEME.textSecondary}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {suggestion.category}
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              lineHeight: 19,
              marginTop: 4,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      {(suggestion.autoCreated || suggestion.spentToDate > 0) && (
        <Text
          style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 19 }}
        >
          {formatCurrency(
            Number.isFinite(suggestion.spentToDate)
              ? suggestion.spentToDate
              : 0,
            currencyCode,
          )}{" "}
          spent so far
        </Text>
      )}
      <BrandInput
        label={`Monthly limit (${currencyCode})`}
        accessibilityLabel={`${suggestion.category} suggested limit`}
        value={suggestion.limitInput}
        onChangeText={onLimitChange}
        keyboardType="decimal-pad"
        placeholder="0"
        editable={!disabled}
      />
    </View>
  );
}
