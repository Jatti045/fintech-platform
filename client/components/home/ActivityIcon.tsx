import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

/** Compact, themed category badges for Home activity and recurring payments. */
export default function ActivityIcon({
  category,
  income,
  transfer,
}: {
  category: string;
  income?: boolean;
  transfer?: boolean;
}) {
  const { THEME } = useTheme();
  const value = category.toLowerCase();
  const icon = transfer
    ? "repeat"
    : income
      ? "credit-card"
      : /grocer|market/.test(value)
        ? "shopping-cart"
        : /food|dining|restaurant|bistro/.test(value)
          ? "coffee"
          : /electric|utility|utilities|energy/.test(value)
            ? "zap"
            : /stream|netflix|entertain|video/.test(value)
              ? "play-circle"
              : /rent|mortgage|housing/.test(value)
                ? "home"
                : /transport|travel|gas|fuel/.test(value)
                  ? "truck"
                  : /shop|retail|merchandise/.test(value)
                    ? "shopping-bag"
                    : /health|fitness|medical/.test(value)
                      ? "heart"
                      : "credit-card";
  return (
    <View
      accessible={false}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        flexShrink: 0,
        backgroundColor: THEME.subtleSurface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name={icon} size={21} color={THEME.primary} />
    </View>
  );
}
