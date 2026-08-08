/**
 * Manual mock for expo-notifications used by Jest.
 * Mirrors only the APIs the notification feature touches, backed by an
 * in-memory store of "scheduled" notifications so unit tests never need a
 * real device.
 */

/// <reference types="jest" />

export interface MockScheduledNotification {
  identifier: string;
  content?: { title?: string; body?: string; data?: { kind?: string } };
  trigger?: { type?: string; hour?: number; minute?: number };
}

const scheduledNotifications: MockScheduledNotification[] = [];

export const AndroidImportance = {
  DEFAULT: 3,
  MAX: 5,
  HIGH: 4,
  LOW: 2,
  MIN: 1,
  NONE: 0,
  UNSPECIFIED: 0,
};

export const SchedulableTriggerInputTypes = {
  DAILY: "daily",
  CALENDAR: "calendar",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
  DATE: "date",
  TIME_INTERVAL: "timeInterval",
};

export const setNotificationChannelAsync = jest
  .fn()
  .mockResolvedValue(null);

const defaultPermissions = { granted: true, status: "granted", canAskAgain: true };
export const getPermissionsAsync = jest.fn().mockResolvedValue(defaultPermissions);
export const requestPermissionsAsync = jest.fn().mockResolvedValue(defaultPermissions);

export const getAllScheduledNotificationsAsync = jest.fn().mockImplementation(() =>
  Promise.resolve([...scheduledNotifications]),
);

export const cancelScheduledNotificationAsync = jest.fn().mockImplementation(
  (identifier: string) => {
    const index = scheduledNotifications.findIndex((n) => n.identifier === identifier);
    if (index >= 0) scheduledNotifications.splice(index, 1);
    return Promise.resolve();
  },
);

export const scheduleNotificationAsync = jest.fn().mockImplementation(
  (request: { identifier: string }) => {
    scheduledNotifications.push(request);
    return Promise.resolve(request.identifier);
  },
);

export const addNotificationResponseReceivedListener = jest.fn(() => ({
  remove: jest.fn(),
}));

export const getLastNotificationResponseAsync = jest
  .fn()
  .mockResolvedValue(null);

// ── Test helpers (not part of the real API) ─────────────────────────────────

export function __resetNotifications() {
  scheduledNotifications.length = 0;
  getPermissionsAsync.mockResolvedValue(defaultPermissions);
  requestPermissionsAsync.mockResolvedValue(defaultPermissions);
  cancelScheduledNotificationAsync.mockClear();
  scheduleNotificationAsync.mockClear();
  getAllScheduledNotificationsAsync.mockClear();
  setNotificationChannelAsync.mockClear();
}

export function __setScheduled(
  notifications: MockScheduledNotification[],
) {
  scheduledNotifications.length = 0;
  scheduledNotifications.push(...notifications);
}

export function __getScheduled(): MockScheduledNotification[] {
  return [...scheduledNotifications];
}

export function __setPermissions(permissions: {
  granted?: boolean;
  status?: string;
  canAskAgain?: boolean;
}) {
  const next = { ...defaultPermissions, ...permissions };
  getPermissionsAsync.mockResolvedValue(next);
  requestPermissionsAsync.mockResolvedValue(next);
}

export function __setLastNotificationResponse(
  response: { notification: { request: { content: { data: { kind?: string } } } } } | null,
) {
  getLastNotificationResponseAsync.mockResolvedValue(response);
}
