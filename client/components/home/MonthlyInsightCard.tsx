import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { useLazyGetMonthlyInsightQuery } from "@/store/api/apiSlice";
import GlassPanel from "@/components/global/GlassPanel";

type Props = {
  /** Selected calendar month (zero-based) from the shared month state. */
  month: number;
  /** Selected calendar year from the shared month state. */
  year: number;
};

const GENERATION_ERROR = "Couldn't generate your monthly explanation right now.";

/**
 * "✨ Explain my month" — lazily fetches the backend's AI-generated monthly
 * explanation when tapped and renders it as a summary + highlight bullets.
 *
 * Self-contained and failure-tolerant by design: an AI failure shows an
 * inline error and never affects any other Home section.
 */
export default function MonthlyInsightCard({ month, year }: Props) {
  const { THEME } = useTheme();
  const [fetchInsight, { data, isLoading, isFetching, error }] =
    useLazyGetMonthlyInsightQuery();

  const handlePress = () => {
    fetchInsight({ currentMonth: month, currentYear: year });
  };

  const showLoading = isLoading || isFetching;
  const showResult = Boolean(data?.summary);
  const showError = Boolean(error) && !showResult;

  return (
    <GlassPanel padding={16} radius={18} style={{ marginBottom: 14 }}>
      {!showResult ? (
        <TouchableOpacity
          onPress={handlePress}
          disabled={showLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Explain my month"
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 6,
            }}
          >
            {showLoading ? (
              <ActivityIndicator
                size="small"
                color={THEME.primary}
                style={{ marginRight: 8 }}
              />
            ) : (
              <Text style={{ fontSize: 15, marginRight: 8 }}>✨</Text>
            )}
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 14,
                fontWeight: "800",
              }}
            >
              {showLoading ? "Generating your explanation…" : "Explain my month"}
            </Text>
          </View>
          {!showLoading && (
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 11,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Get a quick read on your month
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, marginRight: 8 }}>✨</Text>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 14,
                fontWeight: "800",
              }}
            >
              Your month
            </Text>
          </View>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {data?.summary}
          </Text>
          {data && data.highlights.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {data.highlights.map((highlight, index) => (
                <View
                  key={`${index}-${highlight}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      color: THEME.primary,
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
                      fontSize: 12,
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
            marginTop: 8,
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
    </GlassPanel>
  );
}
