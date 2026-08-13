// ─── Profile Domain Types ───────────────────────────────────────────────────

import type { IUser } from "@/types/user/types";
import type { ITheme } from "@/types/theme/types";
import type { IPlaidItem } from "@/types/plaid/types";

/** Represents a single item in the Settings list. */
export interface SettingsItem {
  title: string;
  icon: string;
  onPress: () => void;
  isDestructive?: boolean;
}

/** Shape of the theme option rendered in the theme switcher. */
export interface ThemeOption {
  name: string;
  color: string;
  icon: string;
}

/** Payload returned by delete-account dispatch. */
export interface DeleteAccountPayload {
  success: boolean;
  message: string;
}

/** Props shared by sub-components that need theme colours. */
export interface ThemedProps {
  THEME: ITheme;
}

/** Props for ProfileAvatar. */
export interface ProfileAvatarProps extends ThemedProps {
  user: IUser | null;
  uploading: boolean;
  deleting: boolean;
  onPickImage: () => void;
  onDeleteImage: () => void;
}

/** Props for ProfileHeader. */
export interface ProfileHeaderProps extends ThemedProps {
  user: IUser | null;
  uploading: boolean;
  deleting: boolean;
  onPickImage: () => void;
  onDeleteImage: () => void;
}

/** Props for ThemeSwitcher. */
export interface ThemeSwitcherProps extends ThemedProps {
  selectedTheme: string;
  onThemeSelect: (name: string) => void;
}

/** Props for CurrencySelector (the row that opens the picker). */
export interface CurrencySelectorProps extends ThemedProps {
  userCurrency: string;
  onPress: () => void;
}

/** Props for SettingsList. */
export interface SettingsListProps extends ThemedProps {
  items: SettingsItem[];
}

/** Props for ChangePasswordModal. */
export interface ChangePasswordModalProps extends ThemedProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (current: string, next: string, confirm: string) => Promise<void>;
  saving: boolean;
}

/** Props for CurrencyPickerModal. */
export interface CurrencyPickerModalProps extends ThemedProps {
  visible: boolean;
  userCurrency: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

/** Props for BankConnections. */
export interface BankConnectionsProps extends ThemedProps {
  /** True while the Plaid Link flow is open / token exchange is in flight. */
  linking: boolean;
  /** Starts the bank-connection flow (fetch link token + open Plaid Link). */
  onLinkBank: () => Promise<void> | void;
  /** Active bank connections linked to the user's profile. */
  items: IPlaidItem[];
  /** True while the connected-items list is being fetched. */
  loadingItems: boolean;
  /** Id of the item currently being disconnected (spinner state), or null. */
  disconnectingId: string | null;
  /** Prompts for confirmation and disconnects the given bank item. */
  onDisconnect: (item: IPlaidItem) => void;
}
