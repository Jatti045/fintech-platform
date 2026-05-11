import React, {useState} from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getModalHeight, MODAL_BORDER_RADIUS } from "@/constants/appConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import ModalCloseButton from "@/components/global/modalCloseButton";
import useGoalOperation from "@/hooks/goal/useGoalOperation";
import PresetChips from "@/components/global/PresetChips";
import Loader from "@/utils/loader";


interface GoalAllocateModalProps {
  openSheet: boolean;
  setOpenSheet: (open: boolean) => void;
  goalToAllocate: string | null;
  handleAllocateModalClose: () => void;
  mode: "allocate" | "deallocate";
  saving: boolean;
}

function GoalAllocateModal({
  openSheet,
  setOpenSheet,
    goalToAllocate,
    handleAllocateModalClose,
  mode,
  saving,
}: GoalAllocateModalProps) {
  const { THEME } = useTheme();
  const {handleSubmitAllocation} = useGoalOperation()
    const [allocateAmount, setAllocateAmount] = useState("");
  const isAllocate = mode === "allocate";
  const title = isAllocate ? "Allocate to Goal" : "Withdraw from Goal";
  const buttonText = isAllocate? "Allocate" : "Withdraw";
  const modalHeight = getModalHeight();

  const onSubmit = () => handleSubmitAllocation(allocateAmount, goalToAllocate, mode, handleAllocateModalClose);


  return (
    <Modal
      visible={openSheet}
      animationType="slide"
      transparent={true}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <SafeAreaView
          style={{
            height: modalHeight,
            backgroundColor: THEME.background,
            padding: 18,
            position: "relative",
            borderTopLeftRadius: MODAL_BORDER_RADIUS,
            borderTopRightRadius: MODAL_BORDER_RADIUS,
            overflow: "hidden",
              borderWidth: 1,
              borderTopColor: THEME.border,
          }}
        >
          <View className="relative mb-4">
            <ModalCloseButton setOpenSheet={setOpenSheet} />
          </View>

          <View className="items-center justify-center relative mb-4">
            <Text
              style={{ color: THEME.textPrimary }}
              className="text-lg text-center font-bold"
            >
              {title}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="mt-4">
              <Text style={{ color: THEME.textSecondary }} className="mb-2">
                Amount
              </Text>
              <View
                style={{
                  backgroundColor: THEME.inputBackground,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: THEME.textSecondary, fontWeight: "600" }}>
                  $
                </Text>
                <TextInput
                  value={allocateAmount}
                  onChangeText={(v) =>
                    setAllocateAmount(v.replace(/[^0-9.]/g, ""))
                  }
                  keyboardType="numeric"
                  placeholder="Amount"
                  placeholderTextColor={THEME.placeholderText}
                  style={{
                    color: THEME.textPrimary,
                    flex: 1,
                    paddingVertical: 8,
                  }}
                />
              </View>
                <PresetChips selected={allocateAmount} setSelected={setAllocateAmount} />
            </View>

            <View className="mt-6">
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onSubmit}
                disabled={saving}
              >
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  start={[0, 0]}
                  end={[1, 1]}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    opacity: saving ? 0.8 : 1,
                  }}
                >
                  <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                    {buttonText}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
            {saving && <Loader msg="Saving goal..." />}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default GoalAllocateModal;
