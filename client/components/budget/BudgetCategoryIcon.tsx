import React from "react";
import { View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";

export interface BudgetCategoryIconProps {
  category: string;
  size?: number;
}

/**
 * BudgetCategoryIcon — provides the restrained category icons with tinted
 * surfaces matching the Budgee design system and reference mockup:
 * - Food & Drink: amber with fork/knife
 * - General Services: neutral surface with settings cog
 * - General Merchandise: neutral surface with shopping bag
 * - Entertainment: crimson with game controller
 * - Travel: sky blue with airplane
 * - Transportation: blue with car
 * - Housing: purple with home
 * - Health: rose with heart
 * - Personal Care: violet with sparkles
 * - Education: blue with book
 */
export default function BudgetCategoryIcon({
  category = "",
  size = 38,
}: BudgetCategoryIconProps) {
  const { THEME } = useTheme();
  const norm = category.toLowerCase().trim();
  const iconSize = Math.round(size * 0.48);

  // 1. Food & Drink / Dining / Groceries / Restaurants
  if (
    norm.includes("food") ||
    norm.includes("drink") ||
    norm.includes("dining") ||
    norm.includes("restaurant") ||
    norm.includes("grocer")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#F59E0B", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="restaurant" size={iconSize} color="#F59E0B" />
      </View>
    );
  }

  // 2. General Services / Professional Services / Software
  if (
    norm.includes("service") ||
    norm.includes("software") ||
    norm.includes("utility") ||
    norm.includes("bill")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: THEME.surfaceHover,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name="settings-sharp"
          size={iconSize}
          color={THEME.textSecondary}
        />
      </View>
    );
  }

  // 3. General Merchandise / Shopping / Retail
  if (
    norm.includes("merchandise") ||
    norm.includes("shopping") ||
    norm.includes("retail") ||
    norm.includes("goods")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: THEME.surfaceHover,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather
          name="shopping-bag"
          size={iconSize}
          color={THEME.textSecondary}
        />
      </View>
    );
  }

  // 4. Entertainment / Gaming / Streaming / Movies / Music
  if (
    norm.includes("entertainment") ||
    norm.includes("game") ||
    norm.includes("gaming") ||
    norm.includes("movie") ||
    norm.includes("music")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#F87171", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="game-controller" size={iconSize} color="#F87171" />
      </View>
    );
  }

  // 5. Travel / Flights / Hotels / Vacation
  if (
    norm.includes("travel") ||
    norm.includes("flight") ||
    norm.includes("hotel") ||
    norm.includes("vacation") ||
    norm.includes("airline")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#60A5FA", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="airplane" size={iconSize} color="#60A5FA" />
      </View>
    );
  }

  // 6. Transportation / Auto / Gas / Fuel / Car / Ride
  if (
    norm.includes("transport") ||
    norm.includes("auto") ||
    norm.includes("car") ||
    norm.includes("gas") ||
    norm.includes("fuel") ||
    norm.includes("ride")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#60A5FA", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="car" size={iconSize} color="#60A5FA" />
      </View>
    );
  }

  // 7. Housing / Rent / Mortgage / Home
  if (
    norm.includes("house") ||
    norm.includes("housing") ||
    norm.includes("rent") ||
    norm.includes("mortgage") ||
    norm.includes("home")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#A78BFA", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="home" size={iconSize} color="#A78BFA" />
      </View>
    );
  }

  // 8. Health / Medical / Fitness / Pharmacy
  if (
    norm.includes("health") ||
    norm.includes("medical") ||
    norm.includes("fitness") ||
    norm.includes("doctor") ||
    norm.includes("pharmacy")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#F43F5E", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="heart" size={iconSize} color="#F43F5E" />
      </View>
    );
  }

  // 9. Personal Care / Beauty / Wellness
  if (
    norm.includes("personal") ||
    norm.includes("beauty") ||
    norm.includes("wellness")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#C084FC", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="sparkles" size={iconSize} color="#C084FC" />
      </View>
    );
  }

  // 10. Education / Books / Tuition
  if (
    norm.includes("education") ||
    norm.includes("book") ||
    norm.includes("tuition") ||
    norm.includes("school")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: hexToRgba("#60A5FA", 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="book" size={iconSize} color="#60A5FA" />
      </View>
    );
  }

  // Fallback
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: THEME.surfaceHover,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name="tag" size={iconSize} color={THEME.textSecondary} />
    </View>
  );
}
