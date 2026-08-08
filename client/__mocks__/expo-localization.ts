/**
 * Manual mock for expo-localization used by Jest.
 * Lets tests control the device timezone to verify timezone-change behaviour.
 */

let timeZone: string | null = "America/Toronto";

export function getCalendars() {
  return [{ timeZone }];
}

export function __setTimeZone(value: string | null) {
  timeZone = value;
}

export function resetMock() {
  timeZone = "America/Toronto";
}
