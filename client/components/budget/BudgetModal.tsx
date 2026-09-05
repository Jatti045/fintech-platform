import React, { useEffect, useRef } from "react";
import { useTheme, useUser } from "@/hooks/useRedux";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import ModalCloseButton from "../global/modalCloseButton";
import { LinearGradient } from "expo-linear-gradient";
import Loader from "@/utils/loader";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrencySymbol } from "@/constants/Currencies";
import PresetChips from "@/components/global/PresetChips";

function BudgetModal({
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
  const currencySymbol = getCurrencySymbol(currencyCode);

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

  const modalHeight = getModalHeight();

  return (
    <Modal visible={openSheet} animationType="slide" transparent={true}>
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
            <ModalCloseButton setOpenSheet={setOpenSheet} />
          </View>

          <View className="items-center justify-center relative mb-4">
            <Text
              style={{ color: THEME.textPrimary }}
              className="text-lg text-center font-bold"
            >
              {editingBudget ? "Update Budget" : "Create Budget"}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="mt-4">
              <Text style={{ color: THEME.textSecondary }} className="mb-2">
                Category Name
              </Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="e.g., Groceries"
                placeholderTextColor={THEME.placeholderText}
                accessibilityLabel="Budget category"
                className="py-3 px-3 rounded-md"
                style={{
                  backgroundColor: THEME.inputBackground,
                  color: THEME.textPrimary,
                  borderColor: THEME.border,
                  borderWidth: 1,
                }}
              />
              <Text
                style={{ color: THEME.textSecondary, marginTop: 6 }}
                className="text-sm"
              >
                Tip: Pick a short category name like &apos;Groceries&apos; or
                &apos;Transport&apos;.
              </Text>
            </View>

            <View className="mt-4">
              <Text style={{ color: THEME.textSecondary }} className="mb-2">
                Limit
              </Text>
              <View
                style={{
                  backgroundColor: THEME.inputBackground,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: THEME.textSecondary, fontWeight: "600" }}>
                  {currencySymbol}
                </Text>
                <TextInput
                  value={limit}
                  onChangeText={(v) => setLimit(v.replace(/[^0-9.]/g, ""))}
                  placeholder="Amount"
                  placeholderTextColor={THEME.placeholderText}
                  keyboardType="numeric"
                  accessibilityLabel="Budget limit amount"
                  style={{
                    color: THEME.textPrimary,
                    flex: 1,
                    paddingVertical: 8,
                  }}
                />
              </View>
              <Text
                style={{ color: THEME.textSecondary, marginTop: 6 }}
                className="text-sm"
              >
                Tip: Enter numbers only. Tap a preset below to quickly set a
                limit.
              </Text>

              {/* preset chips */}
              <PresetChips selected={limit} setSelected={setLimit} />
              <Text
                style={{ color: THEME.textSecondary, marginTop: 2 }}
                className="text-xs"
              >
                Amounts are saved in your default currency ({currencyCode}).
              </Text>
            </View>

            <View className="mt-6">
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  if (editingBudget) {
                    handleUpdateBudget(editingBudget, setOpenSheet);
                  } else {
                    handleCreateBudget(setOpenSheet);
                  }
                }}
              >
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  start={[0, 0]}
                  end={[1, 1]}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                    {editingBudget
                      ? saving
                        ? "Updating..."
                        : "Update Budget"
                      : "Save Budget"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
          {saving && <Loader msg="Saving budget..." />}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default BudgetModal;
