import RulesManager from "@/components/rules/RulesManager";
import { api } from "@/store/api/apiSlice";
import {
  useAppDispatch,
  useBudgets,
  useTheme,
  useFinancialSummary,
  useTransactionMutationStatus,
} from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { Ionicons } from "@expo/vector-icons";
import { BRAND } from "@/constants/ThemePalettes";
import BrandInput from "@/components/brand/BrandInput";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState, useEffect, useRef } from "react";
import { capitalizeFirst } from "@/utils/helper";
import { useTransactionOperations } from "@/hooks/transaction/useTransactionOperation";
import {
  CURRENCIES,
  getCurrencyByCode,
  getCurrencySymbol,
} from "@/constants/Currencies";
import { getExchangeRate } from "@/utils/currencyConverter";
import { TransactionType } from "@/types/transaction/types";

function TransactionModal({
  openSheet,
  setOpenSheet,
  editingTransaction,
  onClose,
}: {
  openSheet: boolean;
  setOpenSheet: (val: boolean) => void;
  editingTransaction?: any;
  onClose?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [resettingClassification, setResettingClassification] = useState(false);
  const budgets = useBudgets();
  const financialSummary = useFinancialSummary();
  const { THEME } = useTheme();
  const { isAdding, isEditing } = useTransactionMutationStatus();
  const saving = isAdding || isEditing;
  const { showAlert } = useThemedAlert();
  const [showPicker, setShowPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [conversionPreview, setConversionPreview] = useState<string | null>(
    null,
  );
  const [isCalculatingConversion, setIsCalculatingConversion] = useState(false);
  const [convertedAmountForPreview, setConvertedAmountForPreview] = useState(0);

  const {
    txName,
    setTxName,
    txAmount,
    setTxAmount,
    txDate,
    setTxDate,
    txSelectedCategoryAndId,
    setTxSelectedCategoryAndId,
    txCurrency,
    setTxCurrency,
    userCurrency,
    type,
    setType,
    monthStartDate,
    monthEndDate,
    handleCreateTransaction,
    handleUpdateTransaction,
  } = useTransactionOperations();

  // Reopening a new form after month navigation must respect the same bounds
  // already enforced by its date picker. Existing transaction dates are preserved.
  const earliestDate = monthStartDate.getTime();
  const latestDate = monthEndDate.getTime();
  useEffect(() => {
    if (openSheet && !editingTransaction) {
      setTxDate((current) =>
        current.getTime() < earliestDate
          ? new Date(earliestDate)
          : current.getTime() > latestDate
            ? new Date(latestDate)
            : current,
      );
    }
  }, [openSheet, editingTransaction, earliestDate, latestDate, setTxDate]);

  // Track openSheet transitions so we can clear form on close
  const prevOpenRef = useRef(openSheet);
  useEffect(() => {
    if (!openSheet && prevOpenRef.current) {
      // Modal transitioned from open -> closed: clear form fields
      try {
        setTxName("");
        setTxAmount("");
        setTxSelectedCategoryAndId({ id: "", name: "" });
        setTxDate(new Date());
        setTxCurrency(userCurrency);
        setType(TransactionType.EXPENSE);
        setConversionPreview(null);
        setIsCalculatingConversion(false);
        setConvertedAmountForPreview(0);
      } catch {
        // ignore
      }
      if (onClose) onClose();
    }
    prevOpenRef.current = openSheet;
  }, [openSheet]);

  // Populate fields when editingTransaction is provided
  useEffect(() => {
    if (editingTransaction) {
      try {
        const existingOriginalAmount =
          editingTransaction.originalAmount ?? editingTransaction.amount;
        const existingOriginalCurrency =
          editingTransaction.originalCurrency ||
          editingTransaction.baseCurrency ||
          userCurrency;

        setTxName(editingTransaction.name || "");
        setTxAmount(
          existingOriginalAmount == null
            ? ""
            : String(Math.abs(existingOriginalAmount)),
        );
        setTxCurrency(existingOriginalCurrency);
        setTxDate(
          editingTransaction.date
            ? new Date(editingTransaction.date)
            : new Date(),
        );
        const initialBudgetId =
          editingTransaction.budgetId ?? editingTransaction.budget?.id ?? "";
        setTxSelectedCategoryAndId({
          id: initialBudgetId,
          name: editingTransaction.category || "",
        });
        setType(
          editingTransaction.type === TransactionType.INCOME
            ? TransactionType.INCOME
            : TransactionType.EXPENSE,
        );
      } catch {
        // ignore
      }
    }
  }, [editingTransaction, userCurrency]);

  // Show a live conversion preview when amount or currency changes
  useEffect(() => {
    if (txCurrency === userCurrency || !txAmount || Number(txAmount) <= 0) {
      setIsCalculatingConversion(false);
      setConversionPreview(null);
      setConvertedAmountForPreview(Number(txAmount || 0));
      return;
    }
    let cancelled = false;
    setIsCalculatingConversion(true);
    (async () => {
      try {
        const rate = await getExchangeRate(txCurrency, userCurrency);
        if (!cancelled) {
          const converted = (Number(txAmount) * rate).toFixed(2);
          setConvertedAmountForPreview(Number(converted));
          setConversionPreview(
            `≈ ${getCurrencySymbol(userCurrency)}${converted} ${userCurrency} (rate: ${rate.toFixed(4)})`,
          );
          setIsCalculatingConversion(false);
        }
      } catch {
        if (!cancelled) {
          setConvertedAmountForPreview(0);
          setConversionPreview("Unable to fetch rate");
          setIsCalculatingConversion(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [txAmount, txCurrency, userCurrency]);

  const monthlyIncome = Number(financialSummary?.monthlyIncome ?? 0);
  const currentMonthSpent = Number(financialSummary?.totalAmount ?? 0);
  const pendingAmount = Number(convertedAmountForPreview || 0);
  const projectedSpent =
    currentMonthSpent + (pendingAmount > 0 ? pendingAmount : 0);
  const projectedRemaining = monthlyIncome - projectedSpent;
  const projectedPercent =
    monthlyIncome > 0 ? (projectedSpent / monthlyIncome) * 100 : 0;

  const clampDate = (d: Date) => {
    if (d < monthStartDate) return new Date(monthStartDate);
    if (d > monthEndDate) return new Date(monthEndDate);
    return d;
  };

  const formatShortDate = (d: Date) => {
    try {
      return d.toLocaleDateString(undefined, {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d.toDateString();
    }
  };

  const modalHeight = getModalHeight();

  return (
    <Modal
      visible={openSheet}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (!saving) setOpenSheet(false);
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: BRAND.overlay,
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
          {/* Close button */}
          <View style={{ alignItems: "flex-end" }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              disabled={saving}
              onPress={() => setOpenSheet(false)}
              style={{
                width: BRAND.touchTarget,
                height: BRAND.touchTarget,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: BRAND.radius.input,
                backgroundColor: THEME.surface,
              }}
            >
              <Ionicons name="close" size={22} color={THEME.textPrimary} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <Text
                className="text-left text-2xl font-bold pb-6"
                accessibilityRole="header"
                style={{ color: THEME.textPrimary }}
              >
                {editingTransaction
                  ? "Edit Transaction"
                  : "Add New Transaction"}
              </Text>

              {/* Type selector — Expense by default, income optional */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: THEME.inputBackground,
                  borderRadius: BRAND.radius.input,
                  padding: 4,
                  marginBottom: 6,
                }}
              >
                {[
                  { key: TransactionType.EXPENSE, label: "Expense" },
                  { key: TransactionType.INCOME, label: "Income" },
                ].map((opt) => {
                  const active = type === opt.key;
                  const activeColor = THEME.primary;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setType(opt.key)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`${opt.label} transaction`}
                      accessibilityState={{
                        selected: active,
                        disabled: saving,
                      }}
                      disabled={saving}
                      style={{
                        flex: 1,
                        minHeight: BRAND.touchTarget,
                        justifyContent: "center",
                        paddingVertical: 10,
                        borderRadius: 9,
                        alignItems: "center",
                        backgroundColor: active ? activeColor : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: active ? THEME.onPrimary : THEME.textSecondary,
                          fontWeight: "800",
                          fontSize: 14,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="flex-1 gap-6">
                {/* Name Input (simplified + example) */}
                <View>
                  <BrandInput
                    label="Name"
                    placeholder="e.g., Coffee at Joe's, Grocery shopping"
                    value={txName}
                    onChangeText={setTxName}
                    accessibilityLabel="Transaction name"
                    editable={!saving}
                    autoCapitalize="sentences"
                  />
                  <Text
                    style={{ color: THEME.textSecondary, marginTop: 6 }}
                    className="text-sm"
                  >
                    Tip: Use a short descriptive name — store, merchant or note.
                  </Text>
                </View>
                {/* Amount Input (simplified + example) */}
                <View>
                  <BrandInput
                    label="Amount"
                    placeholder="e.g., 4.50 or 120.00"
                    value={txAmount}
                    onChangeText={setTxAmount}
                    accessibilityLabel="Transaction amount"
                    editable={!saving}
                    keyboardType="decimal-pad"
                  />
                  <Text
                    style={{ color: THEME.textSecondary, marginTop: 6 }}
                    className="text-sm"
                  >
                    Tip: Enter the numeric amount without currency symbol. Use a
                    dot for decimals.
                  </Text>

                  {type === TransactionType.EXPENSE && (
                    <View
                      style={{
                        marginTop: 10,
                        backgroundColor: THEME.surface,
                        borderColor: THEME.border,
                        borderWidth: 1,
                        borderRadius: BRAND.radius.input,
                        padding: 10,
                      }}
                    >
                      {monthlyIncome > 0 ? (
                        <>
                          <Text
                            style={{
                              color: THEME.textPrimary,
                              fontWeight: "600",
                            }}
                          >
                            Net spending preview
                          </Text>
                          <Text
                            style={{ color: THEME.textSecondary, marginTop: 4 }}
                          >
                            After this purchase:{" "}
                            {getCurrencySymbol(userCurrency)}
                            {projectedSpent.toFixed(2)} spent of{" "}
                            {getCurrencySymbol(userCurrency)}
                            {monthlyIncome.toFixed(2)} (
                            {projectedPercent.toFixed(1)}%).
                          </Text>
                          <Text
                            style={{
                              marginTop: 4,
                              color:
                                projectedRemaining >= 0
                                  ? THEME.primary
                                  : THEME.danger,
                            }}
                          >
                            Remaining: {getCurrencySymbol(userCurrency)}
                            {projectedRemaining.toFixed(2)}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ color: THEME.textSecondary }}>
                          Set your monthly income in Profile to see net spending
                          vs income.
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Currency Selector */}
                <View>
                  <Text style={{ color: THEME.textPrimary }} className="mb-2">
                    Currency
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Transaction currency"
                    disabled={saving}
                    onPress={() => setShowCurrencyPicker(true)}
                    style={{
                      backgroundColor: THEME.inputBackground,
                      borderColor: THEME.border,
                      borderRadius: BRAND.radius.input,
                      borderWidth: 1,
                      padding: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        flex: 1,
                        flexWrap: "wrap",
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>
                        {getCurrencyByCode(txCurrency)?.flag}
                      </Text>
                      <Text
                        style={{ color: THEME.textPrimary, fontWeight: "600" }}
                      >
                        {txCurrency}
                      </Text>
                      <Text style={{ color: THEME.textSecondary }}>
                        — {getCurrencyByCode(txCurrency)?.name}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={THEME.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Conversion preview */}
                  {isCalculatingConversion ? (
                    <View
                      style={{
                        marginTop: 8,
                        backgroundColor: THEME.surface,
                        borderRadius: BRAND.radius.input,
                        padding: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ActivityIndicator size="small" color={THEME.primary} />
                      <Text
                        style={{
                          color: THEME.primary,
                          fontSize: 13,
                          fontWeight: "500",
                        }}
                      >
                        Calculating conversion rate...
                      </Text>
                    </View>
                  ) : null}

                  {conversionPreview && !isCalculatingConversion && (
                    <View
                      style={{
                        marginTop: 8,
                        backgroundColor: THEME.surface,
                        borderRadius: BRAND.radius.input,
                        padding: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={16}
                        color={THEME.primary}
                      />
                      <Text
                        style={{
                          color: THEME.primary,
                          fontSize: 13,
                          fontWeight: "500",
                        }}
                      >
                        {conversionPreview}
                      </Text>
                    </View>
                  )}

                  {txCurrency !== userCurrency && (
                    <Text
                      style={{ color: THEME.textSecondary, marginTop: 6 }}
                      className="text-sm"
                    >
                      Amount will be converted to {userCurrency} before saving.
                    </Text>
                  )}
                </View>

                {/* Category Selector (expenses only — income has no budget) */}
                {type === TransactionType.EXPENSE && (
                  <View>
                    <Text style={{ color: THEME.textPrimary }} className="mb-4">
                      Category
                    </Text>
                    {budgets.length === 0 && (
                      <Text
                        style={{
                          color: THEME.textSecondary,
                          fontSize: 14,
                          lineHeight: 21,
                        }}
                      >
                        No categories available for this month. Set up a budget
                        category in Budgets to add an expense.
                      </Text>
                    )}
                    {budgets.map((budget) => {
                      const selected = txSelectedCategoryAndId.id === budget.id;
                      return (
                        <TouchableOpacity
                          key={budget.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Category ${budget.category}`}
                          accessibilityState={{ selected, disabled: saving }}
                          disabled={saving}
                          onPress={() =>
                            setTxSelectedCategoryAndId({
                              id: budget.id,
                              name: budget.category,
                            })
                          }
                          style={{
                            minHeight: BRAND.touchTarget,
                            padding: BRAND.spacing.md,
                            marginBottom: BRAND.spacing.sm,
                            flexDirection: "row",
                            gap: BRAND.spacing.sm,
                            alignItems: "center",
                            backgroundColor: selected
                              ? THEME.subtleSurface
                              : THEME.surface,
                            borderWidth: 1,
                            borderColor: selected
                              ? THEME.primary
                              : THEME.border,
                            borderRadius: BRAND.radius.input,
                          }}
                        >
                          <Text
                            style={{
                              color: selected
                                ? THEME.primary
                                : THEME.textPrimary,
                              flex: 1,
                              fontWeight: selected ? "600" : "400",
                            }}
                          >
                            {capitalizeFirst(budget.category)}
                          </Text>
                          {selected && (
                            <Ionicons
                              name="checkmark"
                              size={20}
                              color={THEME.primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {/* Date Picker (compact) */}
                <View className="mx-auto w-full">
                  <Text className="mb-2" style={{ color: THEME.textPrimary }}>
                    Date
                  </Text>
                  <ScrollView
                    horizontal
                    contentContainerStyle={{
                      alignItems: "center",
                      paddingHorizontal: 4,
                      gap: 8,
                    }}
                    showsHorizontalScrollIndicator={false}
                  >
                    <View
                      style={{
                        backgroundColor: THEME.inputBackground,
                        borderColor: THEME.border,
                        borderRadius: BRAND.radius.input,
                        borderWidth: 1,
                        padding: 8,
                        minWidth: 220,
                      }}
                      className="flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Previous day"
                          onPress={() => {
                            const prev = new Date(txDate);
                            prev.setUTCDate(prev.getUTCDate() - 1);
                            setTxDate(clampDate(prev));
                          }}
                          style={{
                            minHeight: BRAND.touchTarget,
                            minWidth: BRAND.touchTarget,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={20}
                            color={THEME.textPrimary}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Open date picker"
                          onPress={() => setShowPicker((s) => !s)}
                          className="py-2 px-3"
                        >
                          <Text style={{ color: THEME.textPrimary }}>
                            {formatShortDate(txDate)}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Next day"
                          activeOpacity={0.7}
                          onPress={() => {
                            const next = new Date(txDate);
                            next.setUTCDate(next.getUTCDate() + 1);
                            setTxDate(clampDate(next));
                          }}
                          style={{
                            minHeight: BRAND.touchTarget,
                            minWidth: BRAND.touchTarget,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={THEME.textPrimary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View
                      style={{
                        justifyContent: "center",
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text
                        style={{ color: THEME.textSecondary }}
                        className="text-sm"
                      >
                        {formatShortDate(monthStartDate)} —{" "}
                        {formatShortDate(monthEndDate)}
                      </Text>
                    </View>
                  </ScrollView>

                  {showPicker && (
                    <DateTimePicker
                      minimumDate={monthStartDate}
                      maximumDate={monthEndDate}
                      value={txDate}
                      mode="date"
                      timeZoneName="UTC"
                      textColor={THEME.textPrimary}
                      display={Platform.OS === "ios" ? "spinner" : "calendar"}
                      onChange={(
                        event: any,
                        selectedDate?: Date | undefined,
                      ) => {
                        // On Android the event.type can be 'dismissed' — only set when a date provided
                        if (selectedDate) {
                          setTxDate(clampDate(selectedDate));
                        }
                        // Close the picker on Android after selection
                        if (Platform.OS !== "ios") setShowPicker(false);
                      }}
                    />
                  )}
                  <Text
                    style={{ color: THEME.textSecondary, marginTop: 6 }}
                    className="text-sm"
                  >
                    Tip: Tap the date to open the picker. Use the arrows for
                    quick day changes.
                  </Text>
                </View>

                {editingTransaction && (
                  <View style={{ paddingVertical: 12 }}>
                    <Text style={{ color: THEME.textSecondary }}>
                      Classification:{" "}
                      {(
                        {
                          USER: "Your choice",
                          RULE: "Matching rule",
                          PROVIDER: "Bank category",
                          LEGACY_UNKNOWN: "Preserved historical category",
                          FALLBACK: "Uncategorized",
                        } as Record<string, string>
                      )[editingTransaction.classification?.categorySource] ||
                        "Existing classification"}
                      {editingTransaction.classification?.ruleTitle
                        ? ` · ${editingTransaction.classification.ruleTitle}`
                        : ""}
                    </Text>
                    <Text style={{ color: THEME.textSecondary }}>
                      Update Transaction applies only to this transaction.
                      Create a rule separately to automate future matches.
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Create rule for future matching transactions"
                      onPress={() => setRulesOpen(true)}
                      style={{ paddingVertical: 12 }}
                    >
                      <Text style={{ color: THEME.primary }}>
                        Create rule for future matching transactions
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Reset classification to bank data"
                      disabled={resettingClassification}
                      style={{ paddingVertical: 12 }}
                      onPress={async () => {
                        setResettingClassification(true);
                        try {
                          await dispatch(
                            api.endpoints.resetTransactionClassification.initiate(
                              editingTransaction.id,
                            ),
                          ).unwrap();
                          setOpenSheet(false);
                        } catch (error) {
                          showAlert({
                            title: "Could not reset classification",
                            message:
                              error instanceof Error
                                ? error.message
                                : "Please try again.",
                          });
                        } finally {
                          setResettingClassification(false);
                        }
                      }}
                    >
                      <Text style={{ color: THEME.primary }}>
                        {resettingClassification
                          ? "Resetting…"
                          : "Reset classification to bank data"}
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ color: THEME.textSecondary }}>
                      Reset removes name, category and budget overrides and
                      bypasses rules for this transaction. If bank metadata is
                      unavailable, the category becomes Uncategorized.
                    </Text>
                  </View>
                )}
                <View className="mb-12">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      editingTransaction
                        ? "Update Transaction"
                        : "Save Transaction"
                    }
                    accessibilityState={{ disabled: saving, busy: saving }}
                    disabled={saving}
                    onPress={async () => {
                      if (saving) return;
                      // Basic front-end validation. Income requires only
                      // name + amount (currency and date always have
                      // defaults); expenses additionally require a
                      // category/budget selection.
                      if (!txName || txAmount === "") {
                        showAlert({ title: "Please fill all fields" });
                        return;
                      }
                      if (
                        type === TransactionType.EXPENSE &&
                        !txSelectedCategoryAndId?.name
                      ) {
                        showAlert({
                          title: "Please select a category",
                        });
                        return;
                      }

                      // If editing, call update handler, otherwise create
                      if (editingTransaction) {
                        handleUpdateTransaction(
                          editingTransaction,
                          setOpenSheet,
                        );
                      } else {
                        handleCreateTransaction(setOpenSheet);
                      }
                    }}
                  >
                    <View
                      style={{
                        minHeight: 54,
                        backgroundColor: saving
                          ? THEME.disabledBackground
                          : THEME.primary,
                        borderRadius: BRAND.radius.button,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {saving && (
                        <ActivityIndicator color={THEME.textDisabled} />
                      )}
                      <Text
                        style={{
                          color: saving ? THEME.textDisabled : THEME.onPrimary,
                        }}
                        className="font-bold text-center py-4"
                      >
                        {editingTransaction
                          ? "Update Transaction"
                          : "Save Transaction"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Cancel transaction"
                    disabled={saving}
                    onPress={() => setOpenSheet(false)}
                    style={{
                      minHeight: BRAND.touchTarget,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: BRAND.spacing.sm,
                    }}
                  >
                    <Text style={{ color: THEME.primary, fontWeight: "600" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Currency Picker Modal */}
          {showCurrencyPicker && (
            <Modal
              visible={showCurrencyPicker}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setShowCurrencyPicker(false)}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: BRAND.overlay,
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    backgroundColor: THEME.background,
                    borderTopLeftRadius: MODAL_BORDER_RADIUS,
                    borderTopRightRadius: MODAL_BORDER_RADIUS,
                    height: modalHeight,
                    paddingBottom: 30,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: THEME.border,
                    }}
                  >
                    <Text
                      style={{
                        color: THEME.textPrimary,
                        fontSize: 18,
                        fontWeight: "700",
                      }}
                    >
                      Select Currency
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Close currency picker"
                      style={{
                        minWidth: BRAND.touchTarget,
                        minHeight: BRAND.touchTarget,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onPress={() => setShowCurrencyPicker(false)}
                    >
                      <Ionicons
                        name="close"
                        size={24}
                        color={THEME.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={CURRENCIES}
                    keyExtractor={(item) => item.code}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Currency ${item.code}`}
                        accessibilityState={{
                          selected: item.code === txCurrency,
                        }}
                        onPress={() => {
                          setTxCurrency(item.code);
                          setShowCurrencyPicker(false);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 14,
                          paddingHorizontal: 20,
                          backgroundColor:
                            item.code === txCurrency
                              ? THEME.subtleSurface
                              : "transparent",
                          borderBottomWidth: 0.5,
                          borderBottomColor: THEME.border,
                        }}
                      >
                        <Text style={{ fontSize: 22, marginRight: 12 }}>
                          {item.flag}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: THEME.textPrimary,
                              fontWeight:
                                item.code === txCurrency ? "700" : "500",
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
                            fontSize: 16,
                            fontWeight: "600",
                          }}
                        >
                          {item.symbol}
                        </Text>
                        {item.code === txCurrency && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={THEME.primary}
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>
          )}
          {rulesOpen && (
            <RulesManager
              visible
              onClose={() => setRulesOpen(false)}
              seed={{
                title: `Classify ${txName}`.slice(0, 80),
                matchText:
                  editingTransaction?.classification?.providerName ||
                  editingTransaction?.name ||
                  txName,
                category: txSelectedCategoryAndId?.name || null,
                budgetCategory:
                  budgets.find((b) => b.id === txSelectedCategoryAndId?.id)
                    ?.category || null,
                direction: type,
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default TransactionModal;
