/**
 * Centralized application-wide constants.
 *
 * Every "magic number" or repeated literal that was previously duplicated
 * across screens, hooks, and slices now lives here.  Import from this file
 * so changes propagate everywhere automatically.
 */

import { Dimensions } from "react-native";

// ── Authentication ───────────────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 6;
export const OTP_LENGTH = 6;

// ── Transactions ─────────────────────────────────────────────────────────────
export const MAX_TRANSACTION_AMOUNT = 1_000_000;
export const PAGINATION_LIMIT = 20;

// ── Budgets ──────────────────────────────────────────────────────────────────
export const BUDGET_PRESET_AMOUNTS = [25, 50, 100, 200, 500];

// ── Networking ───────────────────────────────────────────────────────────────
export const API_TIMEOUT_MS = 60_000;

// ── Cache ────────────────────────────────────────────────────────────────────
export const CACHE_TTL_MS = 3_600_000; // 1 hour

// ── Currency ─────────────────────────────────────────────────────────────────
export const DEFAULT_CURRENCY_CODE = "USD";

// ── OTP ──────────────────────────────────────────────────────────────────────
export const OTP_RESEND_COOLDOWN_S = 60;

// ── UI / Modals ──────────────────────────────────────────────────────────────
/**
 * Calculate modal height as 50% of screen height.
 * Used for half-screen modal presentations.
 */
export const getModalHeight = () => Dimensions.get("window").height * 0.8;

/**
 * Modal border radius for rounded top corners.
 */
export const MODAL_BORDER_RADIUS = 24;

// The dock reserves this space in navigator flow, keeping lists and FABs clear.
export const FLOATING_TAB_BAR = {
  height: 68,
  margin: 20,
  gap: 12,
  padding: 6,
  maxWidth: 560,
  animationDuration: 200,
} as const;
export const getFloatingTabBarHeight = (fontScale = 1) =>
  Math.ceil(FLOATING_TAB_BAR.height + Math.max(0, Math.min(fontScale, 2) - 1) * 28);
