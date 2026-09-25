import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLazyGetMonthlyInsightQuery } from "@/store/api/apiSlice";
import DashboardCard from "./DashboardCard";

type Props = {
  /** Selected calendar month (zero-based) from the shared month state. */
  month: number;
  /** Selected calendar year from the shared month state. */
  year: number;
};

const GENERATION_ERROR =
  "Couldn't generate your monthly explanation right now.";

/**
 * "✨ Explain my month" feature panel.
 * Matches the reference design:
 * - Subtle dark surface with muted olive corner tint
 * - Gold/warm icon badge with sparkles
 * - Two-line description
 * - Pale champagne gold circular action button with right arrow
 * - Clean expand/collapse for AI summary & highlights
 */
export default function MonthlyInsightCard({ month, year }: Props) {
  const [fetchInsight, { data, isLoading, isFetching, error }] =
    useLazyGetMonthlyInsightQuery();
  const [collapsed, setCollapsed] = useState(false);

  const handlePress = () => {
    setCollapsed(false);
    fetchInsight({ currentMonth: month, currentYear: year });
  };

  const showLoading = isLoading || isFetching;
  const showResult = Boolean(data?.summary) && !collapsed;
  const showError = Boolean(error) && !showResult;

  return (
    <DashboardCard
      radius={20}
      padding={16}
      style={{
        marginBottom: 16,
        backgroundColor: "#161618",
        borderColor: "#232326",
      }}
    >
      {/* Subtle organic green tint in the background corner */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -20,
          bottom: -20,
          width: 140,
          height: 100,
          borderRadius: 50,
          backgroundColor: "#16281e",
          opacity: 0.45,
        }}
      />

      {!showResult ? (
        <TouchableOpacity
          onPress={handlePress}
          disabled={showLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Explain my month"
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {/* Left Sparkle Badge */}
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: "#24231b",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showLoading ? (
              <ActivityIndicator size="small" color="#D4AF6A" />
            ) : (
              <Text style={{ fontSize: 18 }}>✨</Text>
            )}
          </View>

          {/* Middle Text Column */}
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: "700",
                letterSpacing: -0.2,
              }}
            >
              {showLoading
                ? "Generating your explanation…"
                : "Explain my month"}
            </Text>
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 12,
                lineHeight: 16.5,
                marginTop: 2,
              }}
            >
              Get a quick read on your spending,{"\n"}habits, and opportunities.
            </Text>
          </View>

          {/* Right Circular Action Button */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#E8D595",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="arrow-right" size={17} color="#161618" />
          </View>
        </TouchableOpacity>
      ) : (
        <View>
          {/* Expanded Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>✨</Text>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Your month
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setCollapsed(true)}
              accessibilityRole="button"
              accessibilityLabel="Close explanation"
              style={{ padding: 4 }}
            >
              <Feather name="chevron-up" size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: "#F4F4F5",
              fontSize: 13.5,
              lineHeight: 20,
            }}
          >
            {data?.summary}
          </Text>

          {data && data.highlights && data.highlights.length > 0 && (
            <View style={{ marginTop: 10, gap: 6 }}>
              {data.highlights.map((highlight, index) => (
                <View
                  key={`${index}-${highlight}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      color: "#4ADE80",
                      fontSize: 13,
                      lineHeight: 19,
                      marginRight: 8,
                    }}
                  >
                    •
                  </Text>
                  <Text
                    style={{
                      color: "#A1A1AA",
                      fontSize: 12.5,
                      lineHeight: 18,
                      flex: 1,
                    }}
                  >
                    {highlight}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {showError && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "#262629",
          }}
        >
          <Feather
            name="alert-circle"
            size={13}
            color="#8E8E93"
            style={{ marginRight: 6 }}
          />
          <Text style={{ color: "#8E8E93", fontSize: 11, flex: 1 }}>
            {GENERATION_ERROR}
          </Text>
          <TouchableOpacity
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={{ color: "#D4AF6A", fontSize: 12, fontWeight: "700" }}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </DashboardCard>
  );
}
