import { Tabs } from "expo-router";
import FundleafTabBar from "@/components/navigation/FundleafTabBar";
import "@/global.css";
import { useTheme } from "@/hooks/useRedux";
import { View } from "react-native";
import { useNotificationOnboarding } from "@/hooks/useNotificationOnboarding";
import NotificationOnboardingModal from "@/components/onboarding/NotificationOnboardingModal";
import PlaidStatusBanner from "@/components/plaid/PlaidStatusBanner";

export default function TabsLayout() {
  const { THEME } = useTheme();
  const notificationOnboarding = useNotificationOnboarding();

  return (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
      <Tabs
        tabBar={(props) => <FundleafTabBar {...props} />}
        screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarAccessibilityLabel: "Home" }} />
        <Tabs.Screen name="transaction" options={{ title: "Transactions", tabBarAccessibilityLabel: "Transactions" }} />
        <Tabs.Screen name="budget" options={{ title: "Budgets", tabBarAccessibilityLabel: "Budgets" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarAccessibilityLabel: "Profile" }} />

        {/* One-time, optional notification prompt after account creation. */}
        <NotificationOnboardingModal
          visible={notificationOnboarding.visible}
          onEnable={() => {
            void notificationOnboarding.handleEnable();
          }}
          onDecline={() => {
            void notificationOnboarding.handleDecline();
          }}
        />
      </Tabs>

      {/* Persistent, non-dismissible banners for re-auth + sync errors. */}
      <PlaidStatusBanner />
    </View>
  );
}
