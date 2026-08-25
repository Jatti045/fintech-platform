/**
 * Notification scheduler – scheduling logic tests.
 * Uses the expo-notifications mock; never touches a real device.
 */

import * as Notifications from "expo-notifications";
import {
  schedulePurchaseReminders,
  scheduleBillReminders,
  cancelBillReminders,
  type BillReminderInput,
} from "@/utils/notifications/scheduler";
import { NOTIFICATION_SCHEDULES, MAX_BILL_REMINDERS } from "@/constants/notifications";
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

describe("upcoming-bill reminders", () => {
  const inTwoDays = (offsetDays = 2) =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString();

  const bill = (overrides: Partial<BillReminderInput> = {}): BillReminderInput => ({
    seriesKey: "NETFLIX",
    name: "Netflix",
    expectedAmount: 15.49,
    nextExpectedDate: inTwoDays(),
    ...overrides,
  });

  it("schedules one reminder per upcoming high-confidence bill", async () => {
    await scheduleBillReminders([
      bill(),
      bill({ seriesKey: "RENT", name: "Rent", expectedAmount: 1450 }),
    ]);

    const scheduled = __getScheduled();
    expect(scheduled).toHaveLength(2);
    expect(scheduled.every((n) => n.identifier.startsWith("bill-reminder-"))).toBe(
      true,
    );
    // Honest, hedged copy — never a guarantee.
    const netflix = scheduled.find((n) => n.content?.data?.kind === "upcomingBill");
    expect(netflix?.content?.body).toContain("usually renews");
    expect(netflix?.content?.body).toContain("$15.49");
  });

  it("ignores bills predicted beyond the reminder horizon", async () => {
    await scheduleBillReminders([
      bill({ nextExpectedDate: inTwoDays(10) }), // 10 days out — too far
      bill({ nextExpectedDate: new Date(Date.now() - 86_400_000).toISOString() }), // past
    ]);

    expect(__getScheduled()).toHaveLength(0);
  });

  it("caps reminders at the configured maximum", async () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      bill({ seriesKey: `S${i}`, name: `Series ${i}` }),
    );
    await scheduleBillReminders(many);

    expect(__getScheduled().length).toBeLessThanOrEqual(MAX_BILL_REMINDERS);
  });

  it("is idempotent — resyncing never accumulates duplicates", async () => {
    const bills = [bill(), bill({ seriesKey: "RENT", name: "Rent" })];

    await scheduleBillReminders(bills);
    await scheduleBillReminders(bills);
    await scheduleBillReminders(bills);

    const scheduled = __getScheduled();
    expect(scheduled).toHaveLength(2);
    const identifiers = scheduled.map((n) => n.identifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it("replaces the set when predictions change", async () => {
    await scheduleBillReminders([bill()]);
    await scheduleBillReminders([bill({ seriesKey: "SPOTIFY", name: "Spotify" })]);

    const scheduled = __getScheduled();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].identifier).toContain("SPOTIFY");
  });

  it("cancels all bill reminders without touching purchase reminders", async () => {
    await schedulePurchaseReminders();
    await scheduleBillReminders([bill()]);

    await cancelBillReminders();

    const scheduled = __getScheduled();
    expect(scheduled.some((n) => n.identifier.startsWith("bill-reminder-"))).toBe(
      false,
    );
    // Purchase reminders untouched.
    expect(
      scheduled.filter((n) => n.identifier.startsWith("purchase-reminder-")),
    ).toHaveLength(2);
  });
});
