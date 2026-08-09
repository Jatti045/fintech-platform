import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAppDispatch } from "@/store";
import {
  useAuth,
  useCalendar,
  useGoals,
  useGoalStatus,
  useTheme,
} from "@/hooks/useRedux";
import { fetchGoals } from "@/store/slices/goalSlice";
import type { IGoal } from "@/types/goal/types";
import {
  EmptyGoalState,
  GoalAllocateModal,
  GoalModal,
  GoalSummitOverview,
  GoalSummitRow,
  GoalTrophyRow,
  NewGoalButton,
} from "@/components/goal";
import SearchBar from "@/components/global/SearchBar";
import SectionHeader from "@/components/global/SectionHeader";
import { useGoalOperation } from "@/hooks/goal/useGoalOperation";
import { hexToRgba } from "@/utils/helper";

export default function GoalsScreen() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const { user } = useAuth();
  const goals = useGoals();
  const { isLoading } = useGoalStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openGoalModal, setOpenGoalModal] = useState(false);
  const [openAllocateModal, setOpenAllocateModal] = useState(false);
  const [allocationMode, setAllocationMode] = useState<
    "allocate" | "deallocate"
  >("allocate");
  const [editingGoal, setEditingGoal] = useState<IGoal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const calendar = useCalendar();
  const isSearching = searchQuery.trim().length > 0;

  const { setGoalName, setGoalTarget, setGoalIcon, handleDeleteGoal } =
    useGoalOperation();
  const currency = user?.currency || "USD";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(
        fetchGoals({
          currentMonth: calendar.month,
          currentYear: calendar.year,
        }),
      );
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, calendar.month, calendar.year]);

  const resetGoalForm = () => {
    setGoalName("");
    setGoalTarget("");
    setGoalIcon("");
  };

  const openCreateGoal = () => {
    setEditingGoal(null);
    resetGoalForm();
    setOpenGoalModal(true);
  };

  const openEditGoal = (goal: IGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name || "");
    setGoalTarget(String(goal.target || ""));
    setGoalIcon(goal.icon || "");
    setOpenGoalModal(true);
  };

  const handleGoalModalClose = () => {
    setOpenGoalModal(false);
    setEditingGoal(null);
    resetGoalForm();
  };

  const handleSetGoalModalOpen = (open: boolean) => {
    if (!open) {
      handleGoalModalClose();
      return;
    }
    setOpenGoalModal(true);
  };

  const openAllocate = (goal: IGoal) => {
    setSelectedGoalId(goal.id);
    setOpenAllocateModal(true);
    setAllocationMode("allocate");
  };

  const openDeallocate = (goal: IGoal) => {
    setSelectedGoalId(goal.id);
    setOpenAllocateModal(true);
    setAllocationMode("deallocate");
  };

  const handleAllocateModalClose = () => {
    setOpenAllocateModal(false);
    setSelectedGoalId(null);
  };

  const handleSetAllocateModalOpen = (open: boolean) => {
    if (!open) {
      handleAllocateModalClose();
      return;
    }
    setOpenAllocateModal(true);
  };

  const handleToggle = useCallback((goal: IGoal) => {
    setExpandedGoalId((prev) => (prev === goal.id ? null : goal.id));
  }, []);

  // ── Derived lists ──────────────────────────────────────────────────────

  const conquered = useMemo(
    () => goals.filter((g) => g.achieved || Number(g.remaining || 0) <= 0),
    [goals],
  );

  const { filteredInFlight, filteredConquered } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const match = (g: IGoal) => !q || (g.name ?? "").toLowerCase().includes(q);

    const inFlight = goals
      .filter((g) => !(g.achieved || Number(g.remaining || 0) <= 0))
      .filter(match)
      .sort((a, b) => {
        const ratioA =
          Number(a.target || 0) > 0
            ? Number(a.progress || 0) / Number(a.target)
            : 0;
        const ratioB =
          Number(b.target || 0) > 0
            ? Number(b.progress || 0) / Number(b.target)
            : 0;
        return ratioB - ratioA;
      });

    const conqueredGoals = conquered.filter(match);
    return {
      filteredInFlight: inFlight,
      filteredConquered: conqueredGoals,
    };
  }, [goals, searchQuery, conquered]);

  const hasGoals = goals.length > 0;
  const isInitialLoading = isLoading && goals.length === 0 && !isSearching;

  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View>
            <Text
              className="text-2xl font-bold"
              style={{ color: THEME.textPrimary }}
            >
              Goals
            </Text>
            <Text
              style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 2 }}
            >
              Every climb starts with a step
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: hexToRgba(THEME.surface, 0.7),
              borderColor: THEME.border,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Feather
              name="map-pin"
              size={13}
              color={THEME.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {filteredInFlight.length} climbing
            </Text>
          </View>
        </View>

        {hasGoals && (
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search goals..."
          />
        )}
      </View>

      <ScrollView
        className="flex-1 pb-30 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSearching ? false : refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        {isInitialLoading ? (
          <View style={{ paddingVertical: 80, alignItems: "center" }}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        ) : hasGoals ? (
          <>
            {/* Summit board */}
            <GoalSummitOverview goals={goals} currencyCode={currency} />

            {/* Hall of fame */}
            <GoalTrophyRow goals={filteredConquered} />

            {/* The climb */}
            {filteredInFlight.length > 0 ? (
              <>
                <SectionHeader
                  title="On the climb"
                  subtitle={`${filteredInFlight.length}`}
                  accent={THEME.primary}
                />
                {filteredInFlight.map((goal) => (
                  <GoalSummitRow
                    key={goal.id}
                    goal={goal}
                    currency={currency}
                    expanded={expandedGoalId === goal.id}
                    onToggle={handleToggle}
                    onEdit={openEditGoal}
                    onAllocate={openAllocate}
                    onDeallocate={openDeallocate}
                    onDelete={handleDeleteGoal}
                  />
                ))}
              </>
            ) : filteredConquered.length === 0 ? (
              <View className="py-12 items-center">
                <Text style={{ color: THEME.textSecondary }}>
                  No goals match “{searchQuery}”
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyGoalState />
        )}
      </ScrollView>

      <NewGoalButton onPress={openCreateGoal} />

      <GoalModal
        openSheet={openGoalModal}
        setOpenSheet={handleSetGoalModalOpen}
        editingGoal={editingGoal}
        saving={isLoading}
        handleGoalModalClose={handleGoalModalClose}
      />

      <GoalAllocateModal
        openSheet={openAllocateModal}
        setOpenSheet={handleSetAllocateModalOpen}
        goalToAllocate={selectedGoalId}
        mode={allocationMode}
        handleAllocateModalClose={handleAllocateModalClose}
        saving={isLoading}
      />
    </SafeAreaView>
  );
}
