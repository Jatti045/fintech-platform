import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "@/hooks/profile/useProfile";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";
import Loader from "@/utils/loader";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ThemeSwitcher from "@/components/profile/ThemeSwitcher";
import CurrencySelector from "@/components/profile/CurrencySelector";
import SettingsList from "@/components/profile/SettingsList";
import NotificationPreference from "@/components/profile/NotificationPreference";
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
    changeOpen,
    closeChangeModal,
    handleChangePassword,
    pwSaving,
    settingsItems,
    purchaseRemindersEnabled,
    notificationPermissionDenied,
    handleTogglePurchaseReminders,
  } = useProfile();

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ backgroundColor: THEME.background }}
      className="flex-1"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        <ProfileHeader
          THEME={THEME}
          user={user}
          uploading={uploading}
          deleting={deleting}
          onPickImage={handlePickImage}
          onDeleteImage={handleDeleteImage}
        />

        {/* Settings */}
        <View className="mb-8">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-xl font-bold mb-4"
          >
            Settings
          </Text>

          <ThemeSwitcher
            THEME={THEME}
            selectedTheme={selectedTheme}
            onThemeSelect={handleThemeSelect}
          />

          <NotificationPreference
            THEME={THEME}
            enabled={purchaseRemindersEnabled}
            permissionDenied={notificationPermissionDenied}
            onToggle={handleTogglePurchaseReminders}
          />

          <CurrencySelector
            THEME={THEME}
            userCurrency={user?.currency || DEFAULT_CURRENCY}
            onPress={() => setCurrencyPickerOpen(true)}
          />

          <View
            style={{
              backgroundColor: THEME.inputBackground,
              borderColor: THEME.border,
            }}
            className="rounded-2xl p-4 border mb-4"
          >
            <Text
              style={{ color: THEME.textPrimary }}
              className="text-base font-semibold mb-2"
            >
              Monthly Income
            </Text>
            <Text style={{ color: THEME.textSecondary }} className="mb-3">
              Set your monthly income to see net spending when creating
              transactions.
            </Text>
            <Text style={{ color: THEME.textSecondary }} className="mb-3">
              Viewing income for {selectedMonthLabel}.
            </Text>
            <TextInput
              value={monthlyIncomeInput}
              onChangeText={setMonthlyIncomeInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={THEME.placeholderText}
              style={{
                backgroundColor: THEME.background,
                borderColor: THEME.border,
                color: THEME.textPrimary,
              }}
              className="border rounded-lg px-3 py-3 mb-3"
            />
            <TouchableOpacity
              onPress={handleSaveMonthlyIncome}
              disabled={monthlyIncomeSaving}
              style={{
                backgroundColor: monthlyIncomeSaving
                  ? THEME.border
                  : THEME.primary,
              }}
              className="rounded-lg py-3 items-center"
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                {monthlyIncomeSaving ? "Saving..." : "Save Monthly Income"}
              </Text>
            </TouchableOpacity>
          </View>

          <SettingsList THEME={THEME} items={settingsItems} />
        </View>
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
