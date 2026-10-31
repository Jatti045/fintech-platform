import FundleafSheet from "@/components/sheets/FundleafSheet";
import { useSheetDismiss } from "@/components/sheets/useSheetDismiss";
import React, { useEffect, useRef } from "react";
import { useTheme, useUser } from "@/hooks/useRedux";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import { Text, TouchableOpacity, View } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
import BrandInput from "@/components/brand/BrandInput";
import BrandButton from "@/components/brand/BrandButton";
import PresetChips from "@/components/global/PresetChips";

export default function BudgetModal({
  openSheet,
  setOpenSheet,
  editingBudget,
  onClose,
}: {
  openSheet: boolean;
  setOpenSheet: (val: boolean) => void;
  editingBudget?: any;
  onClose?: () => void;
}) {
  const { THEME } = useTheme();
  const user = useUser();
  const currencyCode = (user?.currency || "USD").toUpperCase();
  const {
    budgetCategory: category,
    setBudgetCategory: setCategory,
    budgetLimit: limit,
    setBudgetLimit: setLimit,
    budgetSaving: saving,
    handleCreateBudget,
    handleUpdateBudget,
  } = useBudgetOperations();
  const prevOpenRef = useRef(openSheet);
  useEffect(() => {
    if (!openSheet && prevOpenRef.current) {
      // Modal closed — reset form fields
      try {
        setCategory("");
        setLimit("");
      } catch {
        // ignore
      }
      if (onClose) onClose();
    }
    prevOpenRef.current = openSheet;
  }, [openSheet]);

  useEffect(() => {
    if (editingBudget) {
      setCategory(String(editingBudget.category ?? ""));
      setLimit(String(editingBudget.displayLimit ?? editingBudget.limit ?? ""));
    }
  }, [editingBudget]);

  const dirty = editingBudget
    ? category !== String(editingBudget.category ?? "") ||
      limit !== String(editingBudget.displayLimit ?? editingBudget.limit ?? "")
    : Boolean(category || limit);
  const close = useSheetDismiss(() => setOpenSheet(false), dirty, saving);
  return (
    <FundleafSheet
      visible={openSheet}
      onDismiss={close}
      title={editingBudget ? "Update Budget" : "Create Budget"}
      dirty={dirty}
      busy={saving}
    >
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 14,
          lineHeight: 22,
        }}
      >
        Choose a category and set its monthly spending limit. Amounts are saved
        in {currencyCode}.
      </Text>
      <BrandInput
        label="Category name"
        value={category}
        onChangeText={setCategory}
        placeholder="e.g., Groceries"
        accessibilityLabel="Budget category"
        autoCapitalize="sentences"
        editable={!saving}
      />
      <View style={{ gap: BRAND.spacing.sm }}>
        <BrandInput
          label={`Monthly limit (${currencyCode})`}
          value={limit}
          onChangeText={(v) => setLimit(v.replace(/[^0-9.]/g, ""))}
          placeholder="Amount"
          keyboardType="decimal-pad"
          accessibilityLabel="Budget limit amount"
          editable={!saving}
        />
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 12,
            lineHeight: 19,
          }}
        >
          Enter an amount or choose a preset.
        </Text>
        <PresetChips
          selected={limit}
          setSelected={setLimit}
          disabled={saving}
        />
      </View>
      <BrandButton
        label={editingBudget ? "Update Budget" : "Save Budget"}
        loading={saving}
        loadingLabel="Saving budget..."
        onPress={() => {
          if (saving) return;
          if (editingBudget)
            void handleUpdateBudget(editingBudget, setOpenSheet);
          else void handleCreateBudget(setOpenSheet);
        }}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancel budget"
        disabled={saving}
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
