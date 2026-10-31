import React from "react";
import { Text } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import FundleafSheet from "@/components/sheets/FundleafSheet";
export default function InformationModal({
  helpOpen,
  setHelpOpen,
}: {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}) {
  const { THEME } = useTheme();
  return (
    <FundleafSheet
      visible={helpOpen}
      onDismiss={() => setHelpOpen(false)}
      title="Help & Usage"
    >
      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Quick Start — Add a Transaction
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        Tap &quot;New Transaction&quot;. Fill in a short name and the amount,
        choose a category or attach it to a budget, pick the correct date (the
        calendar will show the current month/year) and save. The app prevents
        future-dated transactions — the date is clamped to today for the current
        month.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Create or Edit a Budget
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        Tap &quot;New Budget&quot; to create a budget for the selected month. To
        edit a budget, tap its card from the Budgets list — the same form will
        open pre-filled. You can change the category or limit. The app will
        prevent reducing a limit below the already spent amount.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Deleting — Important
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        Swipe any transaction or budget card to the left to reveal a delete
        button — this is the quickest way to remove items. You can also
        long-press a transaction or budget card to delete it. Budgets that have
        transactions attached cannot be deleted — you&apos;ll be prompted to
        remove or reassign those transactions first. When you delete a
        transaction, the app updates the associated budget&apos;s spent amount
        automatically.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Profile Picture
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        Uploading a new profile picture will automatically remove your previous
        picture from storage. If you&apos;d like to remove your profile picture
        without uploading a new one, long-press your profile picture on the
        Profile screen and choose &quot;Delete&quot;.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Home Overview
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        The home overview shows the selected month&apos;s spending, top
        categories, and a small budget summary.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Search & Filter
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        Both the Transactions and Budgets tabs include a search bar at the top.
        Type a keyword to instantly filter items by name or category. The search
        is case-insensitive and updates as you type.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Home Insights
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        The home screen features analytics cards such as Budget Health Score — a
        quick gauge of how well you&apos;re staying within your budgets for the
        selected month — and Top Categories, which shows where most of your
        spending is going.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Themes & Currency
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        Head to the Profile tab to follow System appearance or switch between
        Light, Dark, Ember, and Aurora colour themes. You can also change your
        default display currency from the same screen — all monetary values will
        be shown in the selected currency.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Offline Cache & Performance
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        The app caches transactions and budgets per user and month for faster
        loading. Cached data is used when the network is unavailable and the app
        revalidates in the background when a network connection is detected.
        Creating or deleting items attempts to update the cache as well.
      </Text>

      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Tips & Best Practices
      </Text>
      <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
        • Swipe left on any transaction or budget card to quickly delete it.
        {"\n"}• Use short category names (e.g. Groceries, Transport).
        {"\n"}• Tap a budget card to edit it (opens the same form used to create
        budgets). Long-press a budget to delete it (only possible when no
        transactions are attached).
        {"\n"}• If you change a budget limit, the app will block reducing the
        limit below the amount already spent for that period.
        {"\n"}• Use the search bar on the Transactions or Budgets tab to quickly
        find items by name or category.
        {"\n"}• Check the Budget Health Score on the home screen to see how your
        spending compares to your limits at a glance.
      </Text>
    </FundleafSheet>
  );
}
