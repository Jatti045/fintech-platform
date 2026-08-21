import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";
import { store } from "../../store";
import { useEffect } from "react";
import { useAppDispatch, useCalendar, useTheme } from "@/hooks/useRedux";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { fetchFinancialSummary } from "@/store/slices/financialSummarySlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { fetchGoals } from "@/store/slices/goalSlice";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import { View } from "react-native";
import { hexToRgba, tintHex } from "@/utils/helper";
import { useNotificationOnboarding } from "@/hooks/useNotificationOnboarding";
import NotificationOnboardingModal from "@/components/onboarding/NotificationOnboardingModal";

interface TabIndicatorProps {
  focused: boolean;
}

function TabIndicator({ focused }: TabIndicatorProps) {
  const { THEME } = useTheme();

  if (!focused) return null;

  return (
    <View
      style={{
        width: 5,
        height: 5,
        borderRadius: 1000,
        backgroundColor: THEME.primary,
        marginTop: 4,
      }}
    />
  );
}

export default function TabsLayout() {
  const TAB_ICON_SIZE = 28;
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const { month, year } = useCalendar();
  const notificationOnboarding = useNotificationOnboarding();

  // Fetch transactions + financial summary + budgets + goals for the selected month whenever calendar changes
  useEffect(() => {
    const state = store.getState();
    const month = state.calendar.month;
    const year = state.calendar.year;
    dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: month,
        currentYear: year,
        page: 1,
        limit: PAGINATION_LIMIT,
        useCache: false, // Disable cache to get accurate pagination
      }),
    );
    dispatch(fetchFinancialSummary({ currentMonth: month, currentYear: year }));
    dispatch(fetchBudgets({ currentMonth: month, currentYear: year }));
    dispatch(fetchGoals({ currentMonth: month, currentYear: year }));
  }, [dispatch, month, year]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: () => null,
        headerStyle: {
          backgroundColor: THEME.border,
          height: 70,
        },
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: tintHex(THEME.surface, 6),
          borderTopColor: hexToRgba(THEME.border, 0.55),
          borderTopWidth: 1,
          height: 70,

          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.15,
          shadowRadius: 12,

          elevation: 8,
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={TAB_ICON_SIZE}
                color={color}
              />
              <TabIndicator focused={focused} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="transaction"
        options={{
          tabBarLabel: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "documents" : "documents-outline"}
                size={TAB_ICON_SIZE}
                color={color}
              />
              <TabIndicator focused={focused} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="budget"
        options={{
          tabBarLabel: "budget",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "card" : "card-outline"}
                color={color}
                size={TAB_ICON_SIZE}
              />
              <TabIndicator focused={focused} />
            </View>
          ),
        }}
      />

      {/*
      <Tabs.Screen
        name="goals"
        options={{
          tabBarLabel: "Goals",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag" color={color} size={size} />
          ),
        }}
      />
      */}
      {/* Expo Router auto-registers every route in this folder, so without
          this entry the Goals tab would reappear with default styling. Setting
          `href: null` hides it from the tab bar entirely. */}
      <Tabs.Screen name="goals" options={{ href: null }} />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "person-circle" : "person-circle-outline"}
                color={color}
                size={TAB_ICON_SIZE}
              />
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
  );
}
