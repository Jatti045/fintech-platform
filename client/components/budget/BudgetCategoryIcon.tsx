import React from "react";
import { View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
export interface BudgetCategoryIconProps {
  category: string;
  size?: number;
}
export default function BudgetCategoryIcon({
  category = "",
  size = 42,
}: BudgetCategoryIconProps) {
  const { THEME } = useTheme();
  const value = category.toLowerCase().trim();
  const iconSize = Math.round(size * 0.57);
  const icon = /grocer|market/.test(value) ? (
    <Feather name="shopping-cart" size={iconSize} color={THEME.primary} />
  ) : /food|drink|dining|restaurant/.test(value) ? (
    <Ionicons name="restaurant-outline" size={iconSize} color={THEME.primary} />
  ) : /bill|utility|utilities/.test(value) ? (
    <Ionicons name="receipt-outline" size={iconSize} color={THEME.primary} />
  ) : /entertain|stream|movie|music|game/.test(value) ? (
    <Ionicons name="film-outline" size={iconSize} color={THEME.primary} />
  ) : /transport|auto|car|gas|fuel|ride/.test(value) ? (
    <Ionicons name="car-outline" size={iconSize} color={THEME.primary} />
  ) : /travel|flight|hotel|vacation|airline/.test(value) ? (
    <Feather name="map-pin" size={iconSize} color={THEME.primary} />
  ) : /house|housing|rent|mortgage|home/.test(value) ? (
    <Feather name="home" size={iconSize} color={THEME.primary} />
  ) : /health|medical|fitness/.test(value) ? (
    <Feather name="heart" size={iconSize} color={THEME.primary} />
  ) : /personal|beauty|wellness/.test(value) ? (
    <Ionicons name="sparkles-outline" size={iconSize} color={THEME.primary} />
  ) : /education|book|tuition/.test(value) ? (
    <Feather name="book-open" size={iconSize} color={THEME.primary} />
  ) : /shop|retail|goods|merchandise/.test(value) ? (
    <Feather name="shopping-bag" size={iconSize} color={THEME.primary} />
  ) : /service|software/.test(value) ? (
    <Feather name="tool" size={iconSize} color={THEME.primary} />
  ) : (
    <Feather name="tag" size={iconSize} color={THEME.primary} />
  );
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        backgroundColor: THEME.subtleSurface,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </View>
  );
}
