import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLazyGetMonthlyInsightQuery } from "@/store/api/apiSlice";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";
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
 * - Subtle surface with muted corner tint
 * - Primary/warm icon badge with sparkles
 * - Two-line description
 * - Primary circular action button with right arrow
 * - Clean expand/collapse for AI summary & highlights
 */
export default function MonthlyInsightCard({ month, year }: Props) {
  const { THEME, selectedTheme } = useTheme();
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

  const actionIconColor = selectedTheme === "Light" ? "#FFFFFF" : "#111113";

  return (
    <DashboardCard
      radius={20}
      padding={16}
      style={{
        marginBottom: 16,
      }}
    >
      {/* Subtle organic tint in the background corner */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -20,
          bottom: -20,
          width: 140,
          height: 100,
          borderRadius: 50,
          backgroundColor: hexToRgba(THEME.success, 0.1),
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
              backgroundColor: hexToRgba(THEME.primary, 0.15),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showLoading ? (
              <ActivityIndicator size="small" color={THEME.primary} />
            ) : (
              <Text style={{ fontSize: 18 }}>✨</Text>
            )}
          </View>

          {/* Middle Text Column */}
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text
              style={{
                color: THEME.textPrimary,
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
                color: THEME.textSecondary,
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
              backgroundColor: THEME.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="arrow-right" size={17} color={actionIconColor} />
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
                  color: THEME.textPrimary,
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
              <Feather
                name="chevron-up"
                size={16}
                color={THEME.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: THEME.textPrimary,
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
                      color: THEME.success,
                      fontSize: 13,
                      lineHeight: 19,
                      marginRight: 8,
                    }}
                  >
                    •
                  </Text>
                  <Text
                    style={{
                      color: THEME.textSecondary,
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
            borderTopColor: THEME.border,
          }}
        >
          <Feather
            name="alert-circle"
            size={13}
            color={THEME.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={{ color: THEME.textSecondary, fontSize: 11, flex: 1 }}>
            {GENERATION_ERROR}
          </Text>
          <TouchableOpacity
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text
              style={{ color: THEME.primary, fontSize: 12, fontWeight: "700" }}
            >
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </DashboardCard>
  );
}
