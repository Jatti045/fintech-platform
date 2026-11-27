import React from "react";
import CreateRecordButton from "@/components/global/CreateRecordButton";

export interface NewBudgetButtonProps {
  onPress: () => void;
}

export default React.memo(function NewBudgetButton({
  onPress,
}: NewBudgetButtonProps) {
  return <CreateRecordButton label="New Budget" onPress={onPress} />;
});
