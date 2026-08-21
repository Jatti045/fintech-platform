/**
 * Notification content tests – verifies message copy and routing payload.
 */

import { getNotificationContent } from "@/utils/notifications/content";

describe("notification content", () => {
  it("provides a midday message", () => {
    const content = getNotificationContent("purchaseReminder", "midday", 0);
    expect(content.title.length).toBeGreaterThan(0);
    expect(content.body.length).toBeGreaterThan(0);
    expect(content.data.kind).toBe("purchaseReminder");
  });

  it("provides an evening message distinct from midday", () => {
    const midday = getNotificationContent("purchaseReminder", "midday", 0);
    const evening = getNotificationContent("purchaseReminder", "evening", 0);
    expect(evening.body).not.toEqual(midday.body);
  });

  it("rotates variants so the user does not get the same message every day", () => {
    const first = getNotificationContent("purchaseReminder", "midday", 0);
    const second = getNotificationContent("purchaseReminder", "midday", 1);
    const third = getNotificationContent("purchaseReminder", "midday", 2);
    const nextDay = getNotificationContent("purchaseReminder", "midday", 3);
    // The rotation cycles: day 0, 1, 2 differ, and day 3 wraps back to day 0.
    expect(second.body).not.toEqual(first.body);
    expect(third.body).not.toEqual(first.body);
    expect(nextDay.body).toEqual(first.body);
  });

  it("reminds the user to log purchases", () => {
    const midday = getNotificationContent("purchaseReminder", "midday", 0);
    const evening = getNotificationContent("purchaseReminder", "evening", 0);
    expect(`${midday.title} ${midday.body} ${evening.body}`).toMatch(/log/i);
  });

  it("keeps messages concise", () => {
    for (const timeSlot of ["midday", "evening"] as const) {
      for (let day = 0; day < 3; day++) {
        const content = getNotificationContent("purchaseReminder", timeSlot, day);
        expect(content.title.length).toBeLessThan(60);
        expect(content.body.length).toBeLessThan(200);
      }
    }
  });

  it("does not use dashes or emoji in any variant", () => {
    for (const timeSlot of ["midday", "evening"] as const) {
      for (let day = 0; day < 3; day++) {
        const content = getNotificationContent("purchaseReminder", timeSlot, day);
        expect(`${content.title} ${content.body}`).not.toMatch(/[—–-]/);
        // eslint-disable-next-line no-control-regex
        expect(content.body).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
    }
  });

  it("throws for an unhandled kind (guards new types)", () => {
    expect(() =>
      getNotificationContent("unknown" as never, "midday"),
    ).toThrow();
  });
});
