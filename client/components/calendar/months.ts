import type { CalendarState } from "@/types/calendar/types";

/** Calendar arithmetic, independent of day counts, DST and leap years. */
export const monthIndex = ({ month, year }: CalendarState) => year * 12 + month;
export function monthAt(index: number): CalendarState {
  const year = Math.floor(index / 12);
  return { year, month: index - year * 12 };
}
export function currentMonthIndex() {
  const now = new Date();
  return monthIndex({ month: now.getUTCMonth(), year: now.getUTCFullYear() });
}
export function monthLabels(index: number) {
  const { month, year } = monthAt(index);
  const date = new Date(0);
  // setUTCFullYear also handles years 0–99 without Date.UTC's 1900 offset.
  date.setUTCFullYear(year, month, 1);
  return {
    month: date.toLocaleDateString(undefined, {
      month: "short",
      timeZone: "UTC",
    }),
    year: String(year),
    full: date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}
