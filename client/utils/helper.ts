import { Feather, Ionicons } from "@expo/vector-icons";

export function capitalizeFirst(text: string): string {
  if (!text) return "";
  const textToString = text.toString();
  return (
    textToString.charAt(0).toUpperCase() + textToString.slice(1).toLowerCase()
  );
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Remove time for accurate day difference
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowOnly.getTime() - dateOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Past 1 week: show formatted date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

import { getCurrencySymbol } from "@/constants/Currencies";

// Number formatter without currency symbol (two decimals)
export const formatNumber = (n: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n);

// Currency formatter that uses the given currency code (defaults to USD)
export const formatCurrency = (n: number, currencyCode?: string) => {
  const symbol = getCurrencySymbol(currencyCode || "USD");
  return `${symbol}${formatNumber(Number(n || 0))}`;
};

/**
 * Converts a #RGB / #RRGGBB hex colour into an `rgba()` string.
 * Used for translucent tints, glows and hairlines on glass surfaces.
 */
export function hexToRgba(hex: string, alpha: number): string {
  let h = String(hex || "").replace("#", "").trim();
  if (!h) return `rgba(0, 0, 0, ${alpha})`;
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length > 6) h = h.slice(0, 6);
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return `rgba(0, 0, 0, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lightens (positive percent) or darkens (negative percent) a hex colour.
 * Clamped to the `[-100, 100]` range.
 */
export function tintHex(hex: string, percent: number): string {
  let h = String(hex || "").replace("#", "").trim();
  if (!h) return hex;
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length > 6) h = h.slice(0, 6);
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return hex;
  const t = percent < 0 ? 0 : 255;
  const p = Math.min(Math.abs(percent), 100) / 100;
  const r = Math.round(((num >> 16) & 255) * (1 - p) + t * p);
  const g = Math.round(((num >> 8) & 255) * (1 - p) + t * p);
  const b = Math.round((num & 255) * (1 - p) + t * p);
  return `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
