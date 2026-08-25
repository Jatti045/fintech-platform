import {Tabs} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import "@/global.css";
import {useTheme} from "@/hooks/useRedux";
import {View} from "react-native";
import {hexToRgba, tintHex} from "@/utils/helper";
import {useNotificationOnboarding} from "@/hooks/useNotificationOnboarding";
import NotificationOnboardingModal from "@/components/onboarding/NotificationOnboardingModal";
import PlaidStatusBanner from "@/components/plaid/PlaidStatusBanner";

interface TabIndicatorProps {
    focused: boolean;
}

function TabIndicator({focused}: TabIndicatorProps) {
    const {THEME} = useTheme();

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
    const {THEME} = useTheme();
    const notificationOnboarding = useNotificationOnboarding();

    return (
        <View style={{flex: 1}}>
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
                        tabBarIcon: ({color, focused}) => (
                            <View style={{alignItems: "center"}}>
                                <Ionicons
                                    name={focused ? "home" : "home-outline"}
                                    size={TAB_ICON_SIZE}
                                    color={color}
                                />
                                <TabIndicator focused={focused}/>
                            </View>
                        ),
                    }}
                />

                <Tabs.Screen
                    name="transaction"
                    options={{
                        tabBarLabel: "Transactions",
                        tabBarIcon: ({color, focused}) => (
                            <View style={{alignItems: "center"}}>
                                <Ionicons
                                    name={focused ? "documents" : "documents-outline"}
                                    size={TAB_ICON_SIZE}
                                    color={color}
                                />
                                <TabIndicator focused={focused}/>
                            </View>
                        ),
                    }}
                />

                <Tabs.Screen
                    name="budget"
                    options={{
                        tabBarLabel: "budget",
                        tabBarIcon: ({color, focused}) => (
                            <View style={{alignItems: "center"}}>
                                <Ionicons
                                    name={focused ? "card" : "card-outline"}
                                    color={color}
                                    size={TAB_ICON_SIZE}
                                />
                                <TabIndicator focused={focused}/>
                            </View>
                        ),
                    }}
                />

                {/* Expo Router auto-registers every route in this folder.
                    All routes in this folder are registered above. */}

                <Tabs.Screen
                    name="profile"
                    options={{
                        tabBarLabel: "Profile",
                        tabBarIcon: ({color, focused}) => (
                            <View style={{alignItems: "center"}}>
                                <Ionicons
                                    name={focused ? "person-circle" : "person-circle-outline"}
                                    color={color}
                                    size={TAB_ICON_SIZE}
                                />
                                <TabIndicator focused={focused}/>
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

            {/* Persistent, non-dismissible banners for re-auth + sync errors.
                Rendered OUTSIDE <Tabs> (inside this full-screen wrapper) so its
                absolute positioning anchors to the whole screen rather than
                react-navigation's internal scene container. */}
            <PlaidStatusBanner/>
        </View>
    );
}
