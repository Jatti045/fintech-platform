import {ScrollView, Text, TouchableOpacity} from "react-native";
import React from "react";
import {useTheme, useUser} from "@/hooks/useRedux";
import {getCurrencySymbol} from "@/constants/Currencies";

interface Props {
    selected: string,
    setSelected: (value: string) => void,
}

export default function PresetChips({selected, setSelected}:Props) {
    const {THEME} = useTheme();
    const user = useUser();
    const currencyCode = (user?.currency || "USD").toUpperCase();
    const currencySymbol = getCurrencySymbol(currencyCode);

    return (
    <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
    >
        {[25, 50, 100, 200, 500].map((n) => (
            <TouchableOpacity
                key={n}
                activeOpacity={0.8}
                onPress={() => setSelected(String(n))}
                style={{
                    backgroundColor:
                        String(selected) === String(n)
                            ? THEME.primary
                            : THEME.surface,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: THEME.border,
                }}
            >
                <Text
                    style={{
                        color:
                            String(selected) === String(n)
                                ? THEME.textPrimary
                                : THEME.textSecondary,
                        fontWeight: "600",
                    }}
                >
                    {currencySymbol}
                    {n}
                </Text>
            </TouchableOpacity>
        ))}
    </ScrollView>
    )
}