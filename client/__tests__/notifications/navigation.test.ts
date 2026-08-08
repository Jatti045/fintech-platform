/**
 * Notification navigation tests – verifies that tapping a purchase reminder
 * routes the user to the purchase/logging screen.
 */

import { router } from "expo-router";
import { __resetNotifications, __setLastNotificationResponse } from "../../__mocks__/expo-notifications";
import * as Notifications from "expo-notifications";
import {
  handleNotificationResponse,
  registerNotificationResponseHandler,
} from "@/utils/notifications/navigation";

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
}));

const makeResponse = (kind?: string) =>
  ({
    notification: {
      request: { content: { data: { kind } } },
    },
  } as any);

beforeEach(() => {
  __resetNotifications();
  (router.navigate as jest.Mock).mockClear();
});

describe("notification navigation", () => {
  it("routes a purchase reminder tap to the transactions tab", () => {
    handleNotificationResponse(makeResponse("purchaseReminder"));
    expect(router.navigate).toHaveBeenCalledWith("/(tabs)/transaction");
  });

  it("does not navigate for an unknown notification kind", () => {
    handleNotificationResponse(makeResponse("unknownKind"));
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("registers a tap listener and queries for a cold-start response", () => {
    registerNotificationResponseHandler();
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it("routes a cold-start (app launched from) purchase reminder", async () => {
    __setLastNotificationResponse(makeResponse("purchaseReminder"));
    registerNotificationResponseHandler();
    // Allow the async cold-start query to resolve.
    await Promise.resolve();
    await Promise.resolve();
    expect(router.navigate).toHaveBeenCalledWith("/(tabs)/transaction");
  });
});
