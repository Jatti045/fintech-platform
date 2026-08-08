/**
 * Notification scheduler – scheduling logic tests.
 * Uses the expo-notifications mock; never touches a real device.
 */

import * as Notifications from "expo-notifications";
import { schedulePurchaseReminders } from "@/utils/notifications/scheduler";
import { NOTIFICATION_SCHEDULES } from "@/constants/notifications";
import {
  __resetNotifications,
  __setScheduled,
  __getScheduled,
} from "../../__mocks__/expo-notifications";

beforeEach(() => {
  __resetNotifications();
});

describe("notification scheduler", () => {
  it("schedules two reminders", async () => {
    await schedulePurchaseReminders();
    expect(__getScheduled()).toHaveLength(2);
  });

  it("schedules one reminder at 12:00", async () => {
    await schedulePurchaseReminders();
    const scheduled = __getScheduled();
    const midday = scheduled.find(
      (n) => n.identifier === "purchase-reminder-midday",
    );
    expect(midday?.trigger).toMatchObject({ hour: 12, minute: 0 });
  });

  it("schedules one reminder at 18:00", async () => {
    await schedulePurchaseReminders();
    const scheduled = __getScheduled();
    const evening = scheduled.find(
      (n) => n.identifier === "purchase-reminder-evening",
    );
    expect(evening?.trigger).toMatchObject({ hour: 18, minute: 0 });
  });

  it("uses a daily, device-local-time trigger", async () => {
    await schedulePurchaseReminders();
    for (const n of __getScheduled()) {
      expect(n.trigger?.type).toBe(Notifications.SchedulableTriggerInputTypes.DAILY);
      expect(typeof n.trigger?.hour).toBe("number");
      expect(typeof n.trigger?.minute).toBe("number");
      // Hour/minute are local; the OS resolves zone + DST, so we only assert a
      // valid time rather than a hardcoded UTC offset.
      expect(n.trigger?.hour).toBeGreaterThanOrEqual(0);
      expect(n.trigger?.hour).toBeLessThan(24);
    }
  });

  it("schedules exactly the identifiers declared in config", async () => {
    await schedulePurchaseReminders();
    const identifiers = __getScheduled()
      .map((n) => n.identifier)
      .sort();
    expect(identifiers).toEqual(
      [...NOTIFICATION_SCHEDULES.map((s) => s.identifier)].sort(),
    );
  });

  it("is idempotent – repeated initialisation never duplicates", async () => {
    await schedulePurchaseReminders();
    await schedulePurchaseReminders();
    await schedulePurchaseReminders();

    const scheduled = __getScheduled();
    expect(scheduled).toHaveLength(2);
    expect(
      scheduled.filter((n) => n.identifier === "purchase-reminder-midday"),
    ).toHaveLength(1);
    expect(
      scheduled.filter((n) => n.identifier === "purchase-reminder-evening"),
    ).toHaveLength(1);
  });

  it("prunes stale duplicate notifications before re-scheduling", async () => {
    __setScheduled([
      { identifier: "purchase-reminder-midday", trigger: { type: "daily" } },
      { identifier: "purchase-reminder-evening", trigger: { type: "daily" } },
      // A leftover duplicate from a hypothetical older bug:
      { identifier: "purchase-reminder-midday", trigger: { type: "daily" } },
    ]);

    await schedulePurchaseReminders();

    const scheduled = __getScheduled();
    expect(scheduled).toHaveLength(2);
    expect(
      scheduled.filter((n) => n.identifier === "purchase-reminder-midday"),
    ).toHaveLength(1);
    expect(
      scheduled.filter((n) => n.identifier === "purchase-reminder-evening"),
    ).toHaveLength(1);
  });
});
