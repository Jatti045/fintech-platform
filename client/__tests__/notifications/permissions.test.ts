/**
 * Notification permission logic tests. Uses the expo-notifications mock to
 * simulate granted / denied / undetermined outcomes.
 */

import * as Notifications from "expo-notifications";
import {
  getPermissionStatus,
  requestPermission,
} from "@/utils/notifications/permissions";
import { __resetNotifications, __setPermissions } from "../../__mocks__/expo-notifications";

beforeEach(() => {
  __resetNotifications();
});

describe("notification permissions", () => {
  it("reports granted when permission is granted", async () => {
    __setPermissions({ granted: true, status: "granted" });
    expect(await getPermissionStatus()).toBe("granted");
  });

  it("reports denied when denied and cannot ask again", async () => {
    __setPermissions({ granted: false, status: "denied", canAskAgain: false });
    expect(await getPermissionStatus()).toBe("denied");
  });

  it("reports undetermined before the user has decided", async () => {
    __setPermissions({ granted: false, status: "undetermined", canAskAgain: true });
    expect(await getPermissionStatus()).toBe("undetermined");
  });

  it("requests permission once and returns the granted outcome", async () => {
    __setPermissions({ granted: true, status: "granted" });
    expect(await requestPermission()).toBe("granted");
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("surfaces a denial after requesting", async () => {
    __setPermissions({ granted: false, status: "denied", canAskAgain: false });
    expect(await requestPermission()).toBe("denied");
  });
});
