/**
 * Notification content tests – verifies message copy and routing payload.
 */

import { getNotificationContent } from "@/utils/notifications/content";

describe("notification content", () => {
  it("provides a midday message", () => {
    const content = getNotificationContent("purchaseReminder", "midday");
    expect(content.title).toMatch(/midday/i);
    expect(content.body.length).toBeGreaterThan(0);
    expect(content.data.kind).toBe("purchaseReminder");
  });

  it("provides an evening message distinct from midday", () => {
    const midday = getNotificationContent("purchaseReminder", "midday");
    const evening = getNotificationContent("purchaseReminder", "evening");
    expect(evening.title).toMatch(/evening/i);
    expect(evening.body).not.toEqual(midday.body);
  });

  it("reminds the user to log purchases", () => {
    const midday = getNotificationContent("purchaseReminder", "midday");
    const evening = getNotificationContent("purchaseReminder", "evening");
    expect(`${midday.title} ${midday.body} ${evening.body}`).toMatch(/log/i);
  });

  it("keeps messages concise", () => {
    const midday = getNotificationContent("purchaseReminder", "midday");
    const evening = getNotificationContent("purchaseReminder", "evening");
    expect(midday.body.length).toBeLessThan(200);
    expect(evening.body.length).toBeLessThan(200);
  });

  it("throws for an unhandled kind (guards new types)", () => {
    expect(() =>
      getNotificationContent("unknown" as never, "midday"),
    ).toThrow();
  });
});
