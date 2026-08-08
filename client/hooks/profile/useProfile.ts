// ─── useProfile Hook ────────────────────────────────────────────────────────
// Single source of truth for all profile-screen state, side-effects, and
// handler logic.  The profile screen composes dumb sub-components that
// receive slices of this hook's return value as props.

import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";

import { useAppDispatch, useAppSelector, useAuth, useCalendar, useTheme } from "@/hooks/useRedux";
import {
  deleteUserAccount,
  logoutUser,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  updateUserCurrency,
  updateUserMonthlyIncome,
  loadUserFromStorage,
} from "@/store/slices/userSlice";
import { setTheme } from "@/store/slices/themeSlice";
import {
  persistNotificationPreferences,
  setPurchaseRemindersEnabled,
  selectNotificationTimezone,
  selectPurchaseRemindersEnabled,
  selectNotificationPermissionStatus,
} from "@/store/slices/notificationSlice";
import { userAPI } from "@/api/user";

import { useThemedAlert } from "@/utils/themedAlert";
import { clearRatesCache } from "@/utils/currencyConverter";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";
import { pickProfileImage, persistTheme } from "@/utils/profile/profileService";

import type { DeleteAccountPayload, SettingsItem } from "@/types/profile/types";

// ─── Return type (explicit so consumers get autocomplete) ───────────────────

export interface UseProfileReturn {
  /** Redux user object */
  user: ReturnType<typeof useAuth>["user"];
  /** Theme colours & selected theme name */
  THEME: ReturnType<typeof useTheme>["THEME"];
  selectedTheme: string;

  /** Loading / overlay flags */
  uploading: boolean;
  deleting: boolean;
  refreshing: boolean;

  /** Pull-to-refresh callback */
  onRefresh: () => Promise<void>;

  /** Avatar handlers */
  handlePickImage: () => Promise<void>;
  handleDeleteImage: () => void;

  /** Theme handler */
  handleThemeSelect: (name: string) => Promise<void>;

  /** Currency picker state & handler */
  currencyPickerOpen: boolean;
  setCurrencyPickerOpen: (open: boolean) => void;
  handleCurrencySelect: (code: string) => void;

  /** Selected calendar context */
  selectedMonthLabel: string;

  /** Monthly income input + save */
  monthlyIncomeInput: string;
  setMonthlyIncomeInput: (value: string) => void;
  handleSaveMonthlyIncome: () => Promise<void>;
  monthlyIncomeSaving: boolean;

  /** Change-password modal state & handler */
  changeOpen: boolean;
  closeChangeModal: () => void;
  openChangeModal: () => void;
  handleChangePassword: (
    current: string,
    next: string,
    confirm: string,
  ) => Promise<void>;
  pwSaving: boolean;

  /** Settings list items (log out, change pw, delete) */
  settingsItems: SettingsItem[];

  /** Purchase-reminder preference state + toggle handler */
  purchaseRemindersEnabled: boolean;
  /** True when notifications are not permitted on this device */
  notificationPermissionDenied: boolean;
  handleTogglePurchaseReminders: (enabled: boolean) => void;
}

// ─── Hook Implementation ────────────────────────────────────────────────────

export function useProfile(): UseProfileReturn {
  const dispatch = useAppDispatch();
  const { user, error } = useAuth();
  const calendar = useCalendar();
  const { THEME, selectedTheme } = useTheme();
  const { showAlert } = useThemedAlert();

  // ── local state ──────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [monthlyIncomeSaving, setMonthlyIncomeSaving] = useState(false);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState("");
  const selectedMonthLabel = `${calendar.year}-${String(calendar.month + 1).padStart(2, "0")}`;

  // ── notification preference state ─────────────────────────────────────────
  const purchaseRemindersEnabled = useAppSelector(selectPurchaseRemindersEnabled);
  const notificationTimezone = useAppSelector(selectNotificationTimezone);
  const permissionStatus = useAppSelector(selectNotificationPermissionStatus);
  const notificationPermissionDenied = permissionStatus === "denied";

  const handleTogglePurchaseReminders = useCallback(
    (value: boolean) => {
      dispatch(setPurchaseRemindersEnabled(value));
      // Persist alongside the current timezone to keep stored prefs consistent.
      void persistNotificationPreferences({
        purchaseRemindersEnabled: value,
        timezone: notificationTimezone,
      });
    },
    [dispatch, notificationTimezone],
  );

  const loadMonthlyIncomeForSelectedMonth = useCallback(async () => {
    if (!user?.id) {
      setMonthlyIncomeInput("");
      return;
    }

    try {
      const response = await userAPI.getMonthlyIncome({
        month: calendar.month,
        year: calendar.year,
      });
      setMonthlyIncomeInput(String(Number(response?.data?.monthlyIncome ?? 0)));
    } catch {
      setMonthlyIncomeInput("");
    }
  }, [user?.id, calendar.month, calendar.year]);

  useEffect(() => {
    loadMonthlyIncomeForSelectedMonth();
  }, [loadMonthlyIncomeForSelectedMonth]);

  // ── show Redux-level errors as alerts ────────────────────────────────────
  useEffect(() => {
    if (error) showAlert({ title: "Error", message: error });
  }, [error]);

  // ── pull-to-refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(loadUserFromStorage());
      await loadMonthlyIncomeForSelectedMonth();
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, loadMonthlyIncomeForSelectedMonth]);

  // ── avatar ───────────────────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    const picked = await pickProfileImage();
    if (!picked) {
      // null means permission denied OR user cancelled
      // only alert when it was a permission issue (URI is absent)
      if (picked === null) {
        // We can't distinguish cancel vs denied from the service return,
        // but the native picker already shows nothing on cancel.
      }
      return;
    }
    if (!user?.id) return;

    try {
      setUploading(true);
      const result = await dispatch(
        uploadProfilePicture({ userId: user.id, imageFile: picked }),
      );
      if (uploadProfilePicture.fulfilled.match(result)) {
        router.push("/(tabs)/profile");
      } else if (uploadProfilePicture.rejected.match(result)) {
        showAlert({
          title: "Upload Failed",
          message:
            (result.payload as string) || "Failed to upload profile picture",
        });
      }
    } catch {
      showAlert({
        title: "Upload Failed",
        message: "An unexpected error occurred",
      });
    } finally {
      setUploading(false);
    }
  }, [dispatch, user?.id, showAlert]);

  const handleDeleteImage = useCallback(() => {
    showAlert({
      title: "Delete Profile Picture",
      message: "Are you sure you want to delete your profile picture?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            try {
              setDeleting(true);
              const res: any = await dispatch(deleteProfilePicture(user.id));
              if (deleteProfilePicture.fulfilled.match(res)) {
                showAlert({
                  title: "Deleted",
                  message: "Profile picture deleted.",
                });
              } else {
                showAlert({
                  title: "Deletion Failed",
                  message:
                    (res.payload as string) ||
                    "Failed to delete profile picture",
                });
              }
            } catch (e: any) {
              showAlert({
                title: "Deletion Failed",
                message: e?.message || "Failed to delete profile picture",
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  }, [dispatch, user?.id, showAlert]);

  // ── theme ────────────────────────────────────────────────────────────────
  const handleThemeSelect = useCallback(
    async (themeName: string) => {
      dispatch(setTheme(themeName));
      await persistTheme(themeName);
      showAlert({
        title: "Theme Changed",
        message: `Theme changed to ${themeName}`,
      });
    },
    [dispatch, showAlert],
  );

  // ── currency ─────────────────────────────────────────────────────────────
  const handleCurrencySelect = useCallback(
    (code: string) => {
      const isSelected = code === (user?.currency || DEFAULT_CURRENCY);
      setCurrencyPickerOpen(false);
      if (isSelected) return;

      (async () => {
        try {
          const hasTransactions = await userAPI.hasAnyTransactions();
          if (hasTransactions) {
            showAlert({
              title: "Currency Locked",
              message:
                "You cannot change your default currency because transactions already exist.",
            });
            return;
          }

          const result = await dispatch(updateUserCurrency(code));
          if (updateUserCurrency.fulfilled.match(result)) {
            clearRatesCache();
            showAlert({
              title: "Currency Updated",
              message: `Default currency changed to ${code}`,
            });
          } else {
            showAlert({
              title: "Error",
              message:
                (result.payload as string) || "Failed to update currency",
            });
          }
        } catch (e: any) {
          showAlert({
            title: "Error",
            message: e?.message || "Failed to update currency",
          });
        }
      })();
    },
    [dispatch, user?.currency, showAlert],
  );

  const handleSaveMonthlyIncome = useCallback(async () => {
    const parsed = Number(monthlyIncomeInput);
    if (isNaN(parsed) || parsed < 0) {
      showAlert({
        title: "Invalid monthly income",
        message: "Please enter a non-negative number.",
      });
      return;
    }

    setMonthlyIncomeSaving(true);
    try {
      const result = await dispatch(
        updateUserMonthlyIncome({
          monthlyIncome: parsed,
          month: calendar.month,
          year: calendar.year,
        }),
      );
      if (updateUserMonthlyIncome.fulfilled.match(result)) {
        await loadMonthlyIncomeForSelectedMonth();
        showAlert({
          title: "Monthly income updated",
          message: `Your monthly income is now ${parsed.toFixed(2)} ${user?.currency || DEFAULT_CURRENCY}.`,
        });
      } else {
        showAlert({
          title: "Error",
          message:
            (result.payload as string) || "Failed to update monthly income",
        });
      }
    } catch (e: any) {
      showAlert({
        title: "Error",
        message: e?.message || "Failed to update monthly income",
      });
    } finally {
      setMonthlyIncomeSaving(false);
    }
  }, [
    dispatch,
    monthlyIncomeInput,
    showAlert,
    user?.currency,
    calendar.month,
    calendar.year,
    loadMonthlyIncomeForSelectedMonth,
  ]);

  // ── change password ──────────────────────────────────────────────────────
  const openChangeModal = useCallback(() => setChangeOpen(true), []);
  const closeChangeModal = useCallback(() => setChangeOpen(false), []);

  const handleChangePassword = useCallback(
    async (current: string, next: string, confirm: string) => {
      if (!current || !next || !confirm) {
        showAlert({ title: "Please fill all fields" });
        return;
      }
      if (next !== confirm) {
        showAlert({ title: "New passwords do not match" });
        return;
      }
      setPwSaving(true);
      try {
        const response: any = await dispatch(
          changePassword({
            currentPassword: current,
            newPassword: next,
            confirmPassword: confirm,
          }),
        );
        if (changePassword.fulfilled.match(response)) {
          showAlert({
            title: "Success",
            message: response.payload?.message || "Password changed",
          });
          setChangeOpen(false);
        } else {
          const err =
            response.payload ||
            response.error?.message ||
            "Failed to change password";
          showAlert({ title: "Error", message: err });
        }
      } catch (e: any) {
        showAlert({
          title: "Error",
          message: e?.message || "Failed to change password",
        });
      } finally {
        setPwSaving(false);
      }
    },
    [dispatch, showAlert],
  );

  // ── logout & delete account ──────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    showAlert({
      title: "Confirm Logout",
      message: "Are you sure you want to log out?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => dispatch(logoutUser()),
        },
      ],
    });
  }, [dispatch, showAlert]);

  const handleDeleteAccount = useCallback(() => {
    showAlert({
      title: "Confirm Delete Account",
      message: "Are you sure you want to delete your account?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setTimeout(() => {
              showAlert({
                title: "Delete Account — Irreversible",
                message:
                  "This action is permanent. Once you delete your account, all your data will be lost and cannot be recovered. Are you absolutely sure you want to continue?",
                buttons: [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      if (!user?.id) return;
                      const response = await dispatch(
                        deleteUserAccount(user.id),
                      );
                      const { success, message } =
                        response.payload as DeleteAccountPayload;
                      if (success) {
                        showAlert({
                          title: "Account Deleted",
                          message:
                            "Your account has been deleted successfully.",
                        });
                        router.push("/login");
                      } else {
                        showAlert({
                          title: "Deletion Failed",
                          message: message || "Failed to delete account.",
                        });
                      }
                    },
                  },
                ],
              });
            }, 400);
          },
        },
      ],
    });
  }, [dispatch, user?.id, showAlert]);

  // ── settings list ────────────────────────────────────────────────────────
  const settingsItems: SettingsItem[] = [
    { title: "Log Out", icon: "log-out-outline", onPress: handleLogout },
    {
      title: "Change Password",
      icon: "key-outline",
      onPress: openChangeModal,
    },
    {
      title: "Delete Account",
      icon: "chevron-forward",
      onPress: handleDeleteAccount,
      isDestructive: true,
    },
  ];

  // ── public API ───────────────────────────────────────────────────────────
  return {
    user,
    THEME,
    selectedTheme,
    uploading,
    deleting,
    refreshing,
    onRefresh,
    handlePickImage,
    handleDeleteImage,
    handleThemeSelect,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    handleCurrencySelect,
    selectedMonthLabel,
    monthlyIncomeInput,
    setMonthlyIncomeInput,
    handleSaveMonthlyIncome,
    monthlyIncomeSaving,
    changeOpen,
    closeChangeModal,
    openChangeModal,
    handleChangePassword,
    pwSaving,
    settingsItems,
    purchaseRemindersEnabled,
    notificationPermissionDenied,
    handleTogglePurchaseReminders,
  };
}
