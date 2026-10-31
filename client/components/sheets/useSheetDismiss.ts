import { useCallback } from "react";
import { useThemedAlert } from "@/utils/themedAlert";

/** All user dismissal routes share this guard; successful submissions bypass it. */
export function useSheetDismiss(
  onClose: () => void,
  dirty: boolean,
  busy: boolean,
) {
  const { showAlert } = useThemedAlert();
  return useCallback(() => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    showAlert({
      title: "Discard changes?",
      message: "Your unsaved changes will be lost.",
      buttons: [
        { text: "Keep editing", style: "cancel", onPress: () => {} },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => {
            onClose();
          },
        },
      ],
    });
  }, [busy, dirty, onClose, showAlert]);
}
