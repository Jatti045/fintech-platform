import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";

const ListFooter = React.memo(function ListFooter({
  hasNextPage,
  isLoadingMore,
  hasTransactions,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  hasTransactions: boolean;
  onLoadMore: () => void;
}) {
  const { THEME } = useTheme();
  if (!hasNextPage && !hasTransactions) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: "center", paddingVertical: BRAND.spacing.lg }}
    >
      {isLoadingMore ? (
        <>
          <ActivityIndicator color={THEME.primary} />
          <Text
            style={{ color: THEME.textSecondary, marginTop: BRAND.spacing.sm }}
          >
            Loading more...
          </Text>
        </>
      ) : hasNextPage ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Load more transactions"
          onPress={onLoadMore}
          style={{
            minHeight: BRAND.touchTarget,
            backgroundColor: THEME.subtleSurface,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: BRAND.radius.input,
            justifyContent: "center",
            paddingHorizontal: BRAND.spacing.lg,
          }}
        >
          <Text style={{ color: THEME.textPrimary, fontWeight: "600" }}>
            Load More Transactions
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>
          No more transactions
        </Text>
      )}
    </View>
  );
});
export default ListFooter;
