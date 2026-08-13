import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";
import { store } from "../../store";
import { useEffect } from "react";
import { useAppDispatch, useCalendar, useTheme } from "@/hooks/useRedux";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { fetchGoals } from "@/store/slices/goalSlice";
import { PAGINATION_LIMIT } from "@/constants/appConfig";

export default function TabsLayout() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const { month, year } = useCalendar();

  // Fetch transactions for the selected month whenever calendar changes
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
          height: 80,
        },
        tabBarStyle: {
          backgroundColor: THEME.inputBackground,
          borderTopColor: THEME.border,
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="transaction"
        options={{
          tabBarLabel: "Transactions",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="budget"
        options={{
          tabBarLabel: "Budget",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" color={color} size={size} />
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
