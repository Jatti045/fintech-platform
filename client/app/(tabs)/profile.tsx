import Constants from "expo-constants";
import { BRAND } from "@/constants/ThemePalettes";
import RulesManager from "@/components/rules/RulesManager";
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "@/hooks/profile/useProfile";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";
import Loader from "@/utils/loader";
import ProfileSectionHeader from "@/components/profile/ProfileSectionHeader";
import ProfileHeader from "@/components/profile/ProfileHeader";
import BankConnections from "@/components/profile/BankConnections";
import ThemeSwitcher from "@/components/profile/ThemeSwitcher";
import CurrencySelector from "@/components/profile/CurrencySelector";
import NotificationsCard from "@/components/profile/NotificationsCard";
import MonthlyIncome from "@/components/profile/MonthlyIncome";
import SettingsList from "@/components/profile/SettingsList";
import ChangePasswordModal from "@/components/profile/ChangePasswordModal";
import CurrencyPickerModal from "@/components/profile/CurrencyPickerModal";
import PostConnectionDialog from "@/components/plaid/PostConnectionDialog";
import AiPrivacyPreference from "@/components/privacy/AiPrivacyPreference";

export default function ProfileScreen() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const {
    user,
    THEME,
    selectedTheme,
    uploading,
    deleting,
    refreshing,
    onRefresh,
    handlePickImage,
    handleDeleteImage,
    handleThemeSelect,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    handleCurrencySelect,
    selectedMonthLabel,
    monthlyIncomeInput,
    setMonthlyIncomeInput,
    handleSaveMonthlyIncome,
    monthlyIncomeSaving,
    actualMonthlyIncome,
    monthlyIncomeLoading,
    monthlyIncomeError,
    changeOpen,
    closeChangeModal,
    handleChangePassword,
    pwSaving,
    settingsItems,
    purchaseRemindersEnabled,
    billRemindersEnabled,
    notificationPermissionDenied,
    handleTogglePurchaseReminders,
    handleToggleBillReminders,
    openNotificationSettings,
    linking,
    handleLinkBank,
    plaidItems,
    loadingItems,
    itemsError,
    retryItems,
    disconnectingId,
    handleDisconnectBank,
    connectedItem,
    setConnectedItem,
  } = useProfile();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: THEME.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 40,
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressBackgroundColor={THEME.surface}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          {/* ── Screen Header ────────────────────────────────────────────── */}
          <View style={{ paddingTop: 8, marginBottom: 16 }}>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 28,
                fontWeight: "800",
                letterSpacing: -0.5,
              }}
            >
              Profile
            </Text>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 13.5,
                fontWeight: "400",
                marginTop: 2,
              }}
            >
              Manage your account and preferences
            </Text>
          </View>

          {/* ── Profile / Account Card ───────────────────────────────────── */}
          <ProfileHeader
            THEME={THEME}
            user={user}
            uploading={uploading}
            deleting={deleting}
            onPickImage={handlePickImage}
            onDeleteImage={handleDeleteImage}
          />

          {/* ── Bank Connections Section ─────────────────────────────────── */}
          <ProfileSectionHeader
            title="Connected accounts"
            subtitle="Manage your connections"
          />
          <BankConnections
            THEME={THEME}
            linking={linking}
            onLinkBank={handleLinkBank}
            items={plaidItems}
            loadingItems={loadingItems}
            itemsError={itemsError}
            onRetry={retryItems}
            disconnectingId={disconnectingId}
            onDisconnect={handleDisconnectBank}
          />

          {/* ── Preferences Section ──────────────────────────────────────── */}
          <ProfileSectionHeader
            title="Appearance & currency"
            subtitle="Personalize your experience"
          />
          <View
            style={{
              backgroundColor: THEME.surface,
              borderRadius: BRAND.radius.card,
              borderWidth: 1,
              borderColor: THEME.border,
              padding: 16,
              marginBottom: 8,
            }}
          >
            <ThemeSwitcher
              THEME={THEME}
              selectedTheme={selectedTheme}
              onThemeSelect={handleThemeSelect}
            />

            <View
              style={{
                height: 1,
                backgroundColor: THEME.border,
                marginVertical: 14,
              }}
            />

            <CurrencySelector
              THEME={THEME}
              userCurrency={user?.currency || DEFAULT_CURRENCY}
              onPress={() => setCurrencyPickerOpen(true)}
            />
          </View>

          {/* ── Notifications Section ────────────────────────────────────── */}
          <ProfileSectionHeader
            title="Notifications"
            subtitle="Stay on top of your finances"
          />
          <NotificationsCard
            purchaseRemindersEnabled={purchaseRemindersEnabled}
            billRemindersEnabled={billRemindersEnabled}
            notificationPermissionDenied={notificationPermissionDenied}
            onTogglePurchaseReminders={handleTogglePurchaseReminders}
            onToggleBillReminders={handleToggleBillReminders}
            onOpenSettings={openNotificationSettings}
          />

          <ProfileSectionHeader
            title="Privacy"
            subtitle="Control external AI processing"
          />
          <AiPrivacyPreference />
          {/* ── Income Section ───────────────────────────────────────────── */}
          <ProfileSectionHeader
            title="Income"
            subtitle="Set your planning baseline"
          />
          <MonthlyIncome
            THEME={THEME}
            input={monthlyIncomeInput}
            setInput={setMonthlyIncomeInput}
            monthLabel={selectedMonthLabel}
            saving={monthlyIncomeSaving}
            onSave={handleSaveMonthlyIncome}
            actualIncome={actualMonthlyIncome}
            loading={monthlyIncomeLoading}
            error={monthlyIncomeError}
            currencyCode={user?.currency || "USD"}
          />

          {/* ── Security & Account Section ───────────────────────────────── */}
          <ProfileSectionHeader
            title="Security & account"
            subtitle="Manage your login and data"
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Manage transaction rules"
            onPress={() => setRulesOpen(true)}
            style={{
              padding: 16,
              minHeight: 48,
              backgroundColor: THEME.surface,
              borderWidth: 1,
              borderColor: THEME.border,
              borderRadius: BRAND.radius.card,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: THEME.primary }}>
              Manage transaction rules
            </Text>
          </TouchableOpacity>
          <SettingsList THEME={THEME} items={settingsItems} />
          <ProfileSectionHeader title="About" />
          <View
            style={{
              padding: 20,
              borderRadius: BRAND.radius.card,
              borderWidth: 1,
              borderColor: THEME.border,
              backgroundColor: THEME.surface,
              gap: 8,
            }}
          >
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 20,
                fontWeight: "800",
              }}
            >
              Fundleaf
            </Text>
            <Text style={{ color: THEME.textSecondary }}>
              Your money, your control.
            </Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>
              Open-source personal finance and budgeting.
            </Text>
            {Constants.expoConfig?.version ? (
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                Version {Constants.expoConfig.version}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {rulesOpen && (
        <RulesManager visible onClose={() => setRulesOpen(false)} />
      )}
      {/* ── Modals & Overlays ─────────────────────────────────────────── */}
      <ChangePasswordModal
        THEME={THEME}
        visible={changeOpen}
        onClose={closeChangeModal}
        onSubmit={handleChangePassword}
        saving={pwSaving}
      />

      <CurrencyPickerModal
        THEME={THEME}
        visible={currencyPickerOpen}
        userCurrency={user?.currency || DEFAULT_CURRENCY}
        onSelect={handleCurrencySelect}
        onClose={() => setCurrencyPickerOpen(false)}
      />

      <PostConnectionDialog
        visible={!!connectedItem}
        item={connectedItem}
        onDismiss={() => setConnectedItem(null)}
      />

      {uploading && <Loader msg="Uploading..." />}
      {deleting && <Loader msg="Deleting..." />}
    </SafeAreaView>
  );
}
