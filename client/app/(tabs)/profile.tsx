import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
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
    billRemindersEnabled,
    notificationPermissionDenied,
    handleTogglePurchaseReminders,
    handleToggleBillReminders,
    openNotificationSettings,
    linking,
    handleLinkBank,
    plaidItems,
    loadingItems,
    disconnectingId,
    handleDisconnectBank,
    connectedItem,
    setConnectedItem,
  } = useProfile();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#0B0B0D" }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor="#141416"
            colors={["#D4AF6A"]}
            tintColor="#D4AF6A"
          />
        }
      >
        {/* ── Screen Header ────────────────────────────────────────────── */}
        <View style={{ paddingTop: 8, marginBottom: 16 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 28,
              fontWeight: "800",
              letterSpacing: -0.5,
            }}
          >
            Profile
          </Text>
          <Text
            style={{
              color: "#8E8E93",
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
        <ProfileSectionHeader title="Bank" subtitle="Manage your connections" />
        <BankConnections
          THEME={THEME}
          linking={linking}
          onLinkBank={handleLinkBank}
          items={plaidItems}
          loadingItems={loadingItems}
          disconnectingId={disconnectingId}
          onDisconnect={handleDisconnectBank}
        />

        {/* ── Preferences Section ──────────────────────────────────────── */}
        <ProfileSectionHeader
          title="Preferences"
          subtitle="Personalize your experience"
        />
        <View
          style={{
            backgroundColor: "#141416",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#1F1F23",
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
              backgroundColor: "#1F1F23",
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
        />

        {/* ── Security & Account Section ───────────────────────────────── */}
        <ProfileSectionHeader
          title="Security & Account"
          subtitle="Manage your login and data"
        />
        <SettingsList THEME={THEME} items={settingsItems} />
      </ScrollView>

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
