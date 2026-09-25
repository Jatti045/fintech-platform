import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";
import { useTheme } from "@/hooks/useRedux";
import { View } from "react-native";
import { useNotificationOnboarding } from "@/hooks/useNotificationOnboarding";
import NotificationOnboardingModal from "@/components/onboarding/NotificationOnboardingModal";
import PlaidStatusBanner from "@/components/plaid/PlaidStatusBanner";

interface TabIndicatorProps {
  focused: boolean;
  color?: string;
}

function TabIndicator({ focused, color = "#D4AF6A" }: TabIndicatorProps) {
  if (!focused) return <View style={{ height: 4, marginTop: 4 }} />;

  return (
    <View
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        marginTop: 4,
      }}
    />
  );
}

export default function TabsLayout() {
  const TAB_ICON_SIZE = 24;
  const { THEME } = useTheme();
  const notificationOnboarding = useNotificationOnboarding();

  return (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: THEME.surface,
            borderTopColor: THEME.border,
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 6,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: THEME.primary,
          tabBarInactiveTintColor: THEME.textSecondary,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: "Home",
            tabBarAccessibilityLabel: "Home",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={TAB_ICON_SIZE}
                  color={color}
                />
                <TabIndicator focused={focused} color={THEME.primary} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="transaction"
          options={{
            headerShown: false,
            tabBarLabel: "Transactions",
            tabBarAccessibilityLabel: "Transactions",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "receipt" : "receipt-outline"}
                  size={TAB_ICON_SIZE}
                  color={color}
                />
                <TabIndicator focused={focused} color={THEME.primary} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="budget"
          options={{
            headerShown: false,
            tabBarLabel: "Budgets",
            tabBarAccessibilityLabel: "Budgets",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "pie-chart" : "pie-chart-outline"}
                  color={color}
                  size={TAB_ICON_SIZE}
                />
                <TabIndicator focused={focused} color={THEME.primary} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            headerShown: false,
            tabBarLabel: "Profile",
            tabBarAccessibilityLabel: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "person-circle" : "person-circle-outline"}
                  color={color}
                  size={TAB_ICON_SIZE}
                />
                <TabIndicator focused={focused} color={THEME.primary} />
              </View>
            ),
          }}
        />

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
