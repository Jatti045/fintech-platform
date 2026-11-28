import React from "react";
import CreateRecordButton from "@/components/global/CreateRecordButton";

export default function AddNewTransactionButton({
  setOpenSheet,
  compact = false,
}: {
  setOpenSheet: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <CreateRecordButton
      label="New Transaction"
      compact={compact}
      onPress={() => setOpenSheet(true)}
    />
  );
}
