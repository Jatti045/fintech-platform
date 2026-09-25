import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";
import { useTheme } from "@/hooks/useRedux";
import { View, Text } from "react-native";
import { useNotificationOnboarding } from "@/hooks/useNotificationOnboarding";
import NotificationOnboardingModal from "@/components/onboarding/NotificationOnboardingModal";
import PlaidStatusBanner from "@/components/plaid/PlaidStatusBanner";

interface TabIndicatorProps {
  focused: boolean;
}

function TabIndicator({ focused }: TabIndicatorProps) {
  if (!focused) return <View style={{ height: 4, marginTop: 2 }} />;

  return (
    <View
      style={{
        width: 3.5,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: "#D4AF6A",
        marginTop: 2,
      }}
    />
  );
}

export default function TabsLayout() {
  const TAB_ICON_SIZE = 22;
  const { THEME } = useTheme();
  const notificationOnboarding = useNotificationOnboarding();

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0D" }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: "#111113",
            borderTopColor: "#1A1A1D",
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 6,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: "#D4AF6A",
          tabBarInactiveTintColor: "#8E8E93",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={TAB_ICON_SIZE}
                  color={color}
                />
                <Text
                  style={{
                    color,
                    fontSize: 10,
                    fontWeight: focused ? "600" : "500",
                    marginTop: 2,
                  }}
                >
                  Home
                </Text>
                <TabIndicator focused={focused} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="transaction"
          options={{
            headerShown: false,
            tabBarLabel: "Transactions",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "document-text" : "document-text-outline"}
                  size={TAB_ICON_SIZE}
                  color={color}
                />
                <Text
                  style={{
                    color,
                    fontSize: 10,
                    fontWeight: focused ? "600" : "500",
                    marginTop: 2,
                  }}
                >
                  Transactions
                </Text>
                <TabIndicator focused={focused} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="budget"
          options={{
            headerShown: false,
            tabBarLabel: "Budgets",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "card" : "card-outline"}
                  color={color}
                  size={TAB_ICON_SIZE}
                />
                <Text
                  style={{
                    color,
                    fontSize: 10,
                    fontWeight: focused ? "600" : "500",
                    marginTop: 2,
                  }}
                >
                  Budgets
                </Text>
                <TabIndicator focused={focused} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            headerShown: false,
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={focused ? "person-circle" : "person-circle-outline"}
                  color={color}
                  size={TAB_ICON_SIZE}
                />
                <Text
                  style={{
                    color,
                    fontSize: 10,
                    fontWeight: focused ? "600" : "500",
                    marginTop: 2,
                  }}
                >
                  Profile
                </Text>
                <TabIndicator focused={focused} />
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
