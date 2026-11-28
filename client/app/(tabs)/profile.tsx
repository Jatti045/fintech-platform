import FundleafLoader from "@/components/brand/FundleafLoader";
import Constants from "expo-constants";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import ScreenHeading from "@/components/global/ScreenHeading";
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
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
import AccentPicker from "@/components/profile/AccentPicker";
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
    canConnectBank,
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
            paddingHorizontal: BRAND.gutter,
            paddingBottom: BRAND.spacing.xl,
            width: "100%",
            maxWidth: BRAND.pageWidth,
            alignSelf: "center",
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressBackgroundColor="transparent"
              colors={["transparent"]}
              tintColor="transparent"
            />
          }
        >
          {refreshing && (
            <FundleafLoader
              color={THEME.primary}
              accessibilityLabel="Refreshing"
            />
          )}
          <ScreenHeading title="Profile" />
          <ProfileHeader
            THEME={THEME}
            user={user}
            uploading={uploading}
            deleting={deleting}
            onPickImage={handlePickImage}
            onDeleteImage={handleDeleteImage}
          />

          <ProfileSectionHeader title="Appearance" />
          <View
            style={{
              backgroundColor: THEME.surface,
              borderRadius: BRAND.radius.card,
              padding: BRAND.spacing.md,
            }}
          >
            <ThemeSwitcher
              THEME={THEME}
              selectedTheme={selectedTheme}
              onThemeSelect={handleThemeSelect}
            />
            <AccentPicker />
          </View>

          <ProfileSectionHeader title="Reporting" />
          <View
            style={{
              backgroundColor: THEME.surface,
              borderRadius: BRAND.radius.card,
              paddingHorizontal: BRAND.spacing.md,
            }}
          >
            <CurrencySelector
              THEME={THEME}
              userCurrency={user?.currency || DEFAULT_CURRENCY}
              onPress={() => setCurrencyPickerOpen(true)}
            />
          </View>

          {/* ── Bank Connections Section ─────────────────────────────────── */}
          <ProfileSectionHeader title="Connected accounts" />
          <BankConnections
            THEME={THEME}
            linking={linking}
            canConnectBank={canConnectBank}
            onLinkBank={handleLinkBank}
            items={plaidItems}
            loadingItems={loadingItems}
            itemsError={itemsError}
            onRetry={retryItems}
            disconnectingId={disconnectingId}
            onDisconnect={handleDisconnectBank}
          />

          {/* ── Notifications Section ────────────────────────────────────── */}
          <ProfileSectionHeader title="Notifications" />
          <NotificationsCard
            purchaseRemindersEnabled={purchaseRemindersEnabled}
            billRemindersEnabled={billRemindersEnabled}
            notificationPermissionDenied={notificationPermissionDenied}
            onTogglePurchaseReminders={handleTogglePurchaseReminders}
            onToggleBillReminders={handleToggleBillReminders}
            onOpenSettings={openNotificationSettings}
          />

          {/* ── Income Section ───────────────────────────────────────────── */}
          <ProfileSectionHeader title="Income" />
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
          <ProfileSectionHeader title="Security & account" />
          <SettingsList THEME={THEME} items={settingsItems} />
          <ProfileSectionHeader title="About" />
          <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
            Fundleaf
            {Constants.expoConfig?.version
              ? ` · Version ${Constants.expoConfig.version}`
              : ""}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

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
