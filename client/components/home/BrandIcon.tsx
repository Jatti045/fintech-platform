import React from "react";
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons, Feather } from "@expo/vector-icons";

export interface BrandIconProps {
  name: string;
  category?: string;
  size?: number;
}

export default function BrandIcon({
  name,
  category,
  size = 32,
}: BrandIconProps) {
  const normalized = (name || "").toLowerCase();
  const normalizedCat = (category || "").toLowerCase();

  // 1. Spotify
  if (normalized.includes("spotify")) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#1DB954",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24">
          <Path
            d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.625.625 0 0 1-.86.207c-2.355-1.44-5.32-1.764-8.813-.965a.625.625 0 1 1-.28-1.218c3.824-.874 7.1-.508 9.746 1.115a.625.625 0 0 1 .207.86zm1.226-2.724a.782.782 0 0 1-1.077.257c-2.695-1.657-6.804-2.136-9.992-1.168a.782.782 0 0 1-.462-1.493c3.639-1.104 8.18-.574 11.274 1.327a.782.782 0 0 1 .257 1.077zm.106-2.835C14.69 8.94 9.387 8.767 6.309 9.702a.937.937 0 1 1-.54-1.794c3.535-1.073 9.404-.87 13.116 1.334a.938.938 0 0 1-1.066 1.543z"
            fill="#000000"
          />
        </Svg>
      </View>
    );
  }

  // 2. Netflix
  if (normalized.includes("netflix")) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          backgroundColor: "#141414",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#E50914",
            fontSize: size * 0.62,
            fontWeight: "900",
            includeFontPadding: false,
          }}
        >
          N
        </Text>
      </View>
    );
  }

  // 3. OpenAI / ChatGPT
  if (
    normalized.includes("openai") ||
    normalized.includes("chatgpt") ||
    normalizedCat.includes("general services")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#1e1e20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={size * 0.65}
          height={size * 0.65}
          viewBox="0 0 24 24"
          fill="none"
        >
          <Path
            d="M22.28 9.57a5.98 5.98 0 0 0-.52-4.93 6.06 6.06 0 0 0-6.49-2.9 6.07 6.07 0 0 0-4.57-2.04 6.02 6.02 0 0 0-5.74 4.17 6.06 6.06 0 0 0-4.08 2.96 6.02 6.02 0 0 0 .74 7.08 5.98 5.98 0 0 0 .52 4.93 6.06 6.06 0 0 0 6.49 2.9 6.03 6.03 0 0 0 4.57 2.04 6.02 6.02 0 0 0 5.74-4.17 6.06 6.06 0 0 0 4.08-2.96 6.02 6.02 0 0 0-.74-7.08zm-8.86 11.23a4.52 4.52 0 0 1-2.97-1.1l.15-.09 4.93-2.85a.77.77 0 0 0 .39-.67v-6.95l2.09 1.21a.07.07 0 0 1 .04.05v5.83a4.54 4.54 0 0 1-4.63 4.57zm-8.7-3.77a4.5 4.5 0 0 1-.58-3.12l.15.09 4.93 2.85c.24.14.39.4.39.67v2.42l-2.09-1.21a.07.07 0 0 1-.04-.06v-1.64zm-1.1-7.79a4.52 4.52 0 0 1 2.39-2.02v5.88a.77.77 0 0 0 .38.67l4.93 2.85-2.09 1.21a.07.07 0 0 1-.07 0l-5.05-2.92a4.54 4.54 0 0 1-.49-5.67zm12.63 2.03l-4.93-2.85a.77.77 0 0 0-.77 0l-4.93 2.85-2.09-1.21a.07.07 0 0 1 0-.07l5.05-2.92a4.54 4.54 0 0 1 6.76 2.35l.91 1.85zm3.17 4.67a4.52 4.52 0 0 1-2.39 2.02v-5.88a.77.77 0 0 0-.38-.67l-4.93-2.85 2.09-1.21a.07.07 0 0 1 .07 0l5.05 2.92a4.54 4.54 0 0 1 .49 5.67zm-7.65-1.92l-2.22-1.28 2.22-1.28 2.22 1.28-2.22 1.28z"
            fill="#FFFFFF"
          />
        </Svg>
      </View>
    );
  }

  // 4. Apple
  if (normalized.includes("apple")) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#27272a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="logo-apple" size={size * 0.58} color="#FFFFFF" />
      </View>
    );
  }

  // 5. Transfer out
  if (
    normalizedCat.includes("transfer out") ||
    normalized.includes("transfer out")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#2a1b30",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="swap-horizontal" size={size * 0.55} color="#c084fc" />
      </View>
    );
  }

  // 6. Transfer in
  if (
    normalizedCat.includes("transfer in") ||
    normalized.includes("transfer in")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#162e20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="arrow-up" size={size * 0.52} color="#4ade80" />
      </View>
    );
  }

  // 7. Income / RBC / Payroll / Deposit
  if (
    normalizedCat.includes("income") ||
    normalized.includes("rbc") ||
    normalized.includes("payroll") ||
    normalized.includes("salary")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#162e20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="download" size={size * 0.5} color="#4ade80" />
      </View>
    );
  }

  // 8. Loan / Earnin / Mortgages / Bank
  if (
    normalizedCat.includes("loan") ||
    normalized.includes("earin") ||
    normalized.includes("earnin") ||
    normalizedCat.includes("debt") ||
    normalizedCat.includes("mortgage")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#241b36",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="home" size={size * 0.52} color="#a78bfa" />
      </View>
    );
  }

  // 9. Food & Drink / Dining / Grocery / Smart & Final
  if (
    normalizedCat.includes("food") ||
    normalizedCat.includes("drink") ||
    normalizedCat.includes("restaurant") ||
    normalizedCat.includes("dining") ||
    normalized.includes("smart & final")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#332119",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="restaurant" size={size * 0.52} color="#f97316" />
      </View>
    );
  }

  // 10. Entertainment / Music / Media
  if (
    normalizedCat.includes("entertainment") ||
    normalizedCat.includes("music") ||
    normalizedCat.includes("media")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#152a1e",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="musical-notes" size={size * 0.52} color="#4ade80" />
      </View>
    );
  }

  // 11. General merchandise / Shopping / Retail
  if (
    normalizedCat.includes("merchandise") ||
    normalizedCat.includes("shopping") ||
    normalizedCat.includes("retail")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#27272a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="shopping-bag" size={size * 0.5} color="#e4e4e7" />
      </View>
    );
  }

  // 12. Transport / Travel / Gas / Royal Farms
  if (
    normalizedCat.includes("transport") ||
    normalizedCat.includes("travel") ||
    normalizedCat.includes("car") ||
    normalizedCat.includes("gas") ||
    normalized.includes("royal farms")
  ) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#16253b",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="car" size={size * 0.52} color="#60a5fa" />
      </View>
    );
  }

  // Default fallback
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#1f1f23",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name="credit-card" size={size * 0.48} color="#9ca3af" />
    </View>
  );
}
