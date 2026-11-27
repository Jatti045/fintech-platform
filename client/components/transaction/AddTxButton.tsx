import React from "react";
import CreateRecordButton from "@/components/global/CreateRecordButton";

export default function AddNewTransactionButton({
  setOpenSheet,
}: {
  setOpenSheet: (value: boolean) => void;
}) {
  return (
    <CreateRecordButton
      label="New Transaction"
      onPress={() => setOpenSheet(true)}
    />
  );
}
