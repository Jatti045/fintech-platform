import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "@/hooks/profile/useProfile";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";
import Loader from "@/utils/loader";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ThemeSwitcher from "@/components/profile/ThemeSwitcher";
import CurrencySelector from "@/components/profile/CurrencySelector";
import SettingsList from "@/components/profile/SettingsList";
import NotificationPreference from "@/components/profile/NotificationPreference";
import MonthlyIncome from "@/components/profile/MonthlyIncome";
import BankConnections from "@/components/profile/BankConnections";
import ChangePasswordModal from "@/components/profile/ChangePasswordModal";
import CurrencyPickerModal from "@/components/profile/CurrencyPickerModal";

export default function ProfileScreen() {
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
    changeOpen,
    closeChangeModal,
    handleChangePassword,
    pwSaving,
    settingsItems,
    purchaseRemindersEnabled,
    notificationPermissionDenied,
    handleTogglePurchaseReminders,
    openNotificationSettings,
    linking,
    handleLinkBank,
    plaidItems,
    loadingItems,
    disconnectingId,
    handleDisconnectBank,
  } = useProfile();

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ backgroundColor: THEME.background }}
      className="flex-1"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        {/* Screen title */}
        <View style={{ paddingTop: 12, marginBottom: 4 }}>
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-2xl font-bold"
          >
            Profile
          </Text>
        </View>

        {/* Identity deck */}
        <ProfileHeader
          THEME={THEME}
          user={user}
          uploading={uploading}
          deleting={deleting}
          onPickImage={handlePickImage}
          onDeleteImage={handleDeleteImage}
        />

        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 8,
            marginTop: 4,
          }}
        >
          Bank
        </Text>

        {/* Bank connections */}
        <BankConnections
          THEME={THEME}
          linking={linking}
          onLinkBank={handleLinkBank}
          items={plaidItems}
          loadingItems={loadingItems}
          disconnectingId={disconnectingId}
          onDisconnect={handleDisconnectBank}
        />

        {/* Preferences */}
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 8,
            marginTop: 4,
          }}
        >
          Preferences
        </Text>

        <ThemeSwitcher
          THEME={THEME}
          selectedTheme={selectedTheme}
          onThemeSelect={handleThemeSelect}
        />

        <CurrencySelector
          THEME={THEME}
          userCurrency={user?.currency || DEFAULT_CURRENCY}
          onPress={() => setCurrencyPickerOpen(true)}
        />

        <NotificationPreference
          THEME={THEME}
          enabled={purchaseRemindersEnabled && !notificationPermissionDenied}
          permissionDenied={notificationPermissionDenied}
          onToggle={handleTogglePurchaseReminders}
          onOpenSettings={openNotificationSettings}
        />

        {/* Income */}
        <MonthlyIncome
          THEME={THEME}
          input={monthlyIncomeInput}
          setInput={setMonthlyIncomeInput}
          monthLabel={selectedMonthLabel}
          saving={monthlyIncomeSaving}
          onSave={handleSaveMonthlyIncome}
          actualIncome={actualMonthlyIncome}
        />

        {/* Security & account */}
        <SettingsList THEME={THEME} items={settingsItems} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
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

      {/* Full-screen loading overlays */}
      {uploading && <Loader msg="Uploading..." />}
      {deleting && <Loader msg="Deleting..." />}
    </SafeAreaView>
  );
}
