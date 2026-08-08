/**
 * Notification timezone tests – verifies IANA timezone detection and change
 * detection used to rebuild the schedule when a user travels.
 */

import { getCurrentTimeZone, timezoneChanged } from "@/utils/notifications/timezone";
import { __setTimeZone } from "../../__mocks__/expo-localization";

describe("notification timezone", () => {
  it("reads the device IANA timezone", () => {
    __setTimeZone("Asia/Tokyo");
    expect(getCurrentTimeZone()).toBe("Asia/Tokyo");
  });

  it("detects a change between zones", () => {
    expect(timezoneChanged("America/Toronto", "Asia/Tokyo")).toBe(true);
  });

  it("reports no change when zones match", () => {
    expect(timezoneChanged("America/Toronto", "America/Toronto")).toBe(false);
  });

  it("treats a previously unknown zone as a change", () => {
    expect(timezoneChanged("America/Toronto", null)).toBe(true);
  });

  it("handles a null current zone consistently", () => {
    expect(timezoneChanged(null, null)).toBe(false);
  });
});
