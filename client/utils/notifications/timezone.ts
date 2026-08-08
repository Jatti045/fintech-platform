// ─── Notification Timezone ─────────────────────────────────────────────────
// Detects the device's IANA timezone so the schedule can be rebuilt when a
// user travels or otherwise changes zones. Daily triggers are delivered in
// device-local time by the OS, so the only thing we must manage ourselves is
// detecting when the zone changed and asking the scheduler to re-create the
// schedule for the new zone.

import * as Localization from "expo-localization";

import { logger } from "@/utils/logger";

const SCOPE = "notifications.timezone";

/**
 * Returns the device's IANA timezone identifier (e.g. "America/Toronto") or
 * null when the platform cannot provide one (e.g. some web browsers).
 */
export function getCurrentTimeZone(): string | null {
  try {
    const timeZone = Localization.getCalendars()[0]?.timeZone ?? null;
    return timeZone;
  } catch (error) {
    logger.warn(SCOPE, "Failed to read device timezone", error);
    return null;
  }
}

/** True when the stored zone differs from the current device zone. */
export function timezoneChanged(
  storedZone: string | null,
  currentZone: string | null,
): boolean {
  return storedZone !== currentZone;
}
