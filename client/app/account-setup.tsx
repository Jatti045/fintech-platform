import React, { useRef, useState } from "react";
import { Keyboard, Text, TouchableOpacity, View } from "react-native";
import { getLocales, type Locale } from "expo-localization";
import AuthScreen from "@/components/auth/AuthScreen";
import BrandButton from "@/components/brand/BrandButton";
import BrandInput from "@/components/brand/BrandInput";
import CurrencySelector from "@/components/profile/CurrencySelector";
import CurrencyPickerModal from "@/components/profile/CurrencyPickerModal";
import { BRAND } from "@/constants/ThemePalettes";
import { CURRENCIES, getCurrencyByCode } from "@/constants/Currencies";
import { useAppDispatch, useAuth, useTheme } from "@/hooks/useRedux";
import { completeAccountSetup, logoutUser } from "@/store/slices/userSlice";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import { sessionGeneration } from "@/utils/session";

function incomeAmount(input: string, decimalSeparator: string | null | undefined) {
  const text = input.trim();
  const normalized = decimalSeparator === "," ? text.replace(",", ".") : text;
  if (!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function suggestedCurrency(locale: Locale | undefined) {
  if (locale?.currencyCode) return getCurrencyByCode(locale.currencyCode);

  // On web, locale data may only provide a region. Match supported ISO codes with that prefix.
  const region = locale?.regionCode;
  return CURRENCIES.find((currency) => currency.code.slice(0, 2) === region);
}

export default function AccountSetupRoute() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || user?.setupComplete !== false) return null;
  return <AccountSetupForm key={`${user.id}:${sessionGeneration()}`} />;
}

function AccountSetupForm() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [input, setInput] = useState("");
  const [locale] = useState(() => getLocales()[0]);
  const suggestion = suggestedCurrency(locale);
  const [currency, setCurrency] = useState(suggestion?.code ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [currencyError, setCurrencyError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const submission = useRef(false);
  const selected = getCurrencyByCode(currency);

  const continueToCurrency = () => {
    if (incomeAmount(input, locale?.decimalSeparator) === null) {
      setIncomeError("Enter a monthly amount of zero or more.");
      return;
    }
    Keyboard.dismiss();
    setStep(2);
  };

  const finish = async () => {
    if (submission.current) return;
    const monthlyIncome = incomeAmount(input, locale?.decimalSeparator);
    if (monthlyIncome === null || !selected) {
      setCurrencyError("Choose your default currency.");
      return;
    }

    submission.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await dispatch(completeAccountSetup({ monthlyIncome, currency: selected.code })).unwrap();
    } catch (error) {
      setSaveError(extractErrorMessage(error, "Could not save setup. Please try again."));
    } finally {
      submission.current = false;
      setSaving(false);
    }
  };

  const errorText = (message: string) => message ? (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: THEME.danger }}>
      {message}
    </Text>
  ) : null;

  return (
    <AuthScreen
      title={step === 1 ? "What’s your monthly income?" : "What currency do you use?"}
      description={step === 1
        ? "Fundleaf uses this amount to help you track income. You’ll choose the currency in the next step."
        : "Your choice sets the currency of your monthly income and the default for new transactions."}
    >
      <View style={{ gap: BRAND.spacing.md }}>
        <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>Step {step} of 2</Text>
        {step === 1 ? (
          <>
            <BrandInput
              label="Monthly income"
              keyboardType="decimal-pad"
              value={input}
              placeholder="0.00"
              onChangeText={(text) => {
                setInput(text);
                setIncomeError("");
                setSaveError("");
              }}
              onSubmitEditing={continueToCurrency}
              style={incomeError ? { borderColor: THEME.danger } : undefined}
            />
            {errorText(incomeError)}
            <BrandButton label="Continue" onPress={continueToCurrency} />
          </>
        ) : (
          <>
            <Text style={{ color: THEME.textPrimary }}>
              Monthly income · {selected ? `${selected.code} ` : ""}{input.trim()}
            </Text>
            {suggestion && selected?.code === suggestion.code && (
              <Text style={{ color: THEME.textSecondary }}>Suggested from your device settings</Text>
            )}
            <CurrencySelector
              THEME={THEME}
              userCurrency={currency}
              disabled={saving}
              onPress={() => setPickerOpen(true)}
            />
            {errorText(currencyError)}
            {errorText(saveError)}
            <BrandButton label="Finish setup" loadingLabel="Saving…" loading={saving} onPress={() => void finish()} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => setStep(1)}
              style={{ minHeight: BRAND.touchTarget, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: THEME.textPrimary }}>Back</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => void dispatch(logoutUser())}
          style={{ minHeight: BRAND.touchTarget, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: THEME.textSecondary }}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <CurrencyPickerModal
        visible={pickerOpen}
        THEME={THEME}
        userCurrency={currency}
        onSelect={(code) => {
          setCurrency(code);
          setCurrencyError("");
          setSaveError("");
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </AuthScreen>
  );
}
