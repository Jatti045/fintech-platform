/**
 * useProfile hook tests for the pull-to-refresh flow.
 *
 * Regression coverage for "refreshing Profile navigates back to Home": the
 * refresh handler must revalidate server-backed Profile data WITHOUT re-running
 * the boot-time session-restoration thunk, so the global auth loading flag
 * never flips and the authenticated session/route is never disturbed.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { plaidAPI } from "@/api/plaid";
import { router } from "expo-router";
import { useProfile } from "@/hooks/profile/useProfile";
import { createPlaidLinkSession } from "react-native-plaid-link-sdk";
import userReducer, { loginUser } from "@/store/slices/userSlice";
import themeReducer from "@/store/slices/themeSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import notificationReducer from "@/store/slices/notificationSlice";
import api from "@/store/api/apiSlice";
import { clearRatesCache } from "@/utils/currencyConverter";
import type { IUser } from "@/types/user/types";

jest.mock("@/api/user", () => ({
  userAPI: {
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    getStoredToken: jest.fn(),
    getStoredUser: jest.fn(),
    getMonthlyIncome: jest.fn(),
    uploadProfilePictureById: jest.fn(),
    deleteProfilePictureById: jest.fn(),
    changePassword: jest.fn(),
    hasAnyTransactions: jest.fn(),
    updateCurrency: jest.fn(),
    updateMonthlyIncome: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    googleAuth: jest.fn(),
  },
}));

jest.mock("@/api/plaid", () => {
  const plaidAPI = {
    fetchItems: jest.fn(),
    fetchConnectionCapability: jest.fn(),
    createLinkToken: jest.fn(),
    createUpdateLinkToken: jest.fn(),
    reauthComplete: jest.fn(),
    triggerManualSync: jest.fn(),
    exchangePublicToken: jest.fn(),
    disconnectItem: jest.fn(),
  };
  return {
    __esModule: true,
    plaidAPI,
    default: plaidAPI,
  };
});

jest.mock("react-native-plaid-link-sdk", () => ({
  createPlaidLinkSession: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock("@/utils/profile/profileService", () => ({
  pickProfileImage: jest.fn(),
  persistTheme: jest.fn(),
}));

jest.mock("@/utils/notifications/permissions", () => ({
  getPermissionStatus: jest.fn(),
  requestPermission: jest.fn(),
  ensureAndroidChannel: jest.fn(),
}));

jest.mock("@/utils/currencyConverter", () => ({
  clearRatesCache: jest.fn(),
}));

const mockedGetMonthlyIncome = userAPI.getMonthlyIncome as jest.Mock;
const mockedFetchItems = (plaidAPI as any).fetchItems as jest.Mock;
const mockedCapability = jest.mocked(plaidAPI.fetchConnectionCapability);
const mockedCreateLink = jest.mocked(plaidAPI.createLinkToken);
const mockedExchange = jest.mocked(plaidAPI.exchangePublicToken);
const mockedRouterPush = router.push as jest.Mock;
const mockedRouterReplace = router.replace as jest.Mock;

type Profile = ReturnType<typeof useProfile>;

const user: IUser = {
  id: "u1",
  username: "Test User",
  email: "user@test.com",
  currency: "USD",
};

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      theme: themeReducer,
      calendar: calendarReducer,
      notifications: notificationReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });
}

function setup() {
  const store = makeStore();
  // Authenticate the session exactly as a completed login would.
  renderer.act(() => {
    store.dispatch(
      loginUser.fulfilled({ user, token: "tok" }, "req-1", {
        email: "user@test.com",
        password: "secret1",
      }),
    );
  });

  const captured: { current: Profile | null } = { current: null };
  function Harness() {
    captured.current = useProfile();
    return null;
  }

  let tree!: ReturnType<typeof renderer.create>;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Harness />
        </AlertProvider>
      </Provider>,
    );
  });

  return { captured, store, tree };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Resolves on demand, with a safety timeout so an unresolved gate can never wedge the suite. */
function gatedResponse(value: any, safetyMs = 500) {
  let resolveNow!: (v: any) => void;
  const timer = setTimeout(() => resolveNow(value), safetyMs);
  const promise = new Promise<any>((res) => {
    resolveNow = (v: any) => {
      clearTimeout(timer);
      res(v);
    };
  });
  return { promise, resolve: resolveNow };
}

beforeEach(() => {
  mockedGetMonthlyIncome.mockReset();
  mockedFetchItems.mockReset();
  mockedCapability.mockReset().mockResolvedValue({ canConnectBank: false });
  mockedCreateLink.mockReset();
  mockedExchange.mockReset();
  jest.mocked(createPlaidLinkSession).mockReset();
  mockedRouterPush.mockReset();
  mockedRouterReplace.mockReset();
  (userAPI.getStoredToken as jest.Mock).mockReset();
  (userAPI.getStoredUser as jest.Mock).mockReset();
  (userAPI.hasAnyTransactions as jest.Mock).mockReset();
  (userAPI.updateCurrency as jest.Mock).mockReset();
  (clearRatesCache as jest.Mock).mockReset();
  // Mount effects default: some existing data so refresh deltas are visible.
  mockedGetMonthlyIncome.mockResolvedValue({
    data: { monthlyIncome: 3000, actualMonthlyIncome: 2900 },
  });
  mockedFetchItems.mockResolvedValue({ data: { items: [] } });
});

describe("new bank linking capability", () => {
  it.each([false, true])("gates linking while loading and when the server returns %s", async (allowed) => {
    const gate = gatedResponse({ canConnectBank: allowed });
    mockedCapability.mockReturnValue(gate.promise);
    const { captured, tree } = setup();

    expect(captured.current!.canConnectBank).toBe(false);
    await captured.current!.handleLinkBank();
    expect(mockedCreateLink).not.toHaveBeenCalled();

    await renderer.act(async () => { gate.resolve({ canConnectBank: allowed }); });
    expect(captured.current!.canConnectBank).toBe(allowed);
    renderer.act(() => tree.unmount());
  });

  it("keeps linking unavailable when the capability request fails", async () => {
    mockedCapability.mockRejectedValueOnce(new Error("Offline"));
    const { captured, tree } = setup();
    await renderer.act(flush);
    expect(captured.current!.canConnectBank).toBe(false);
    await captured.current!.handleLinkBank();
    expect(mockedCreateLink).not.toHaveBeenCalled();
    renderer.act(() => tree.unmount());
  });

  it.each(["link token", "token exchange"])("shows the private-linking message after a 403 during %s", async (step) => {
    mockedCapability.mockResolvedValueOnce({ canConnectBank: true });
    const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
    if (step === "link token") {
      mockedCreateLink.mockRejectedValueOnce(forbidden);
    } else {
      mockedCreateLink.mockResolvedValueOnce({ success: true, message: "", data: { linkToken: "link-test" } });
      mockedExchange.mockRejectedValueOnce(forbidden);
      jest.mocked(createPlaidLinkSession).mockImplementationOnce(async ({ onSuccess }) => ({
        open: () => onSuccess?.({ publicToken: "public-test" } as Parameters<NonNullable<typeof onSuccess>>[0]),
      }) as Awaited<ReturnType<typeof createPlaidLinkSession>>);
    }

    const { captured, tree } = setup();
    await renderer.act(flush);
    expect(captured.current!.canConnectBank).toBe(true);
    await renderer.act(async () => { await captured.current!.handleLinkBank(); });
    expect(captured.current!.canConnectBank).toBe(false);
    expect(JSON.stringify(tree.toJSON())).toContain("Bank linking is currently private.");
    renderer.act(() => tree.unmount());
  });
});

describe("useProfile refresh", () => {
  it("revalidates server-backed Profile data without touching the session store", async () => {
    const { captured, store } = setup();

    mockedGetMonthlyIncome.mockResolvedValue({
      data: { monthlyIncome: 5200, actualMonthlyIncome: 4980 },
    });
    mockedFetchItems.mockResolvedValue({
      data: { items: [{ id: "p-1", institutionName: "Acme Bank" }] },
    });

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    // The boot-time session restoration is never re-run by a refresh.
    expect(userAPI.getStoredToken).not.toHaveBeenCalled();
    expect(userAPI.getStoredUser).not.toHaveBeenCalled();

    // The authenticated session in Redux is untouched.
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.user?.id).toBe("u1");

    // Server-backed Profile data refreshed in place, with no navigation.
    expect(captured.current!.monthlyIncomeInput).toBe("5200");
    expect(captured.current!.actualMonthlyIncome).toBe(4980);
    expect(captured.current!.plaidItems).toEqual([
      { id: "p-1", institutionName: "Acme Bank" },
    ]);
    expect(captured.current!.refreshing).toBe(false);
    expect(mockedRouterPush).not.toHaveBeenCalled();
    expect(mockedRouterReplace).not.toHaveBeenCalled();
  });

  it("does not flip the global auth loading flag while a refresh is in flight", async () => {
    const { captured, store } = setup();

    const gate = gatedResponse({
      data: { monthlyIncome: 6400, actualMonthlyIncome: 6100 },
    });
    mockedGetMonthlyIncome.mockReturnValue(gate.promise);

    let inFlight: Promise<void> | undefined;
    renderer.act(() => {
      inFlight = captured.current!.onRefresh();
    });

    // While the refresh is pending, the session-restore flag used by the
    // root layout's splash gate must stay off — otherwise an authenticated
    // user would be bounced to Home.
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(true);

    await renderer.act(async () => {
      gate.resolve({
        data: { monthlyIncome: 6400, actualMonthlyIncome: 6100 },
      });
      await inFlight;
      await flush();
    });
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(captured.current!.refreshing).toBe(false);
    expect(captured.current!.monthlyIncomeInput).toBe("6400");
    expect(mockedRouterPush).not.toHaveBeenCalled();
  });
});

describe("useProfile currency change", () => {
  it("locks currency change when user has existing transactions", async () => {
    const { captured, store } = setup();
    (userAPI.hasAnyTransactions as jest.Mock).mockResolvedValue(true);

    await renderer.act(async () => {
      captured.current!.handleCurrencySelect("EUR");
      await flush();
    });

    expect(userAPI.hasAnyTransactions).toHaveBeenCalled();
    expect(userAPI.updateCurrency).not.toHaveBeenCalled();
    expect(clearRatesCache).not.toHaveBeenCalled();
    expect(store.getState().user.user?.currency).toBe("USD");
  });

  it("allows currency change, updates user state, clears rates cache, and resets RTK Query state when user has no transactions", async () => {
    const { captured, store } = setup();
    (userAPI.hasAnyTransactions as jest.Mock).mockResolvedValue(false);
    (userAPI.updateCurrency as jest.Mock).mockResolvedValue({
      data: { currency: "EUR" },
    });

    // Seed RTK Query cache with query data
    renderer.act(() => {
      store.dispatch(
        api.util.upsertQueryData(
          "getTransactions",
          { currentMonth: 3, currentYear: 2026, limit: 20 },
          {
            data: [],
            page: 1,
            totalPages: 1,
            totalElements: 0,
          } as any,
        ),
      );
    });

    expect(Object.keys(store.getState().api.queries).length).toBeGreaterThan(0);

    await renderer.act(async () => {
      captured.current!.handleCurrencySelect("EUR");
      await flush();
    });

    expect(userAPI.hasAnyTransactions).toHaveBeenCalled();
    expect(userAPI.updateCurrency).toHaveBeenCalledWith("EUR");
    expect(clearRatesCache).toHaveBeenCalled();
    expect(store.getState().user.user?.currency).toBe("EUR");
    // resetApiState must have wiped the RTK Query cache
    expect(Object.keys(store.getState().api.queries).length).toBe(0);
  });

  it("ignores selection if same currency is selected", async () => {
    const { captured } = setup();

    await renderer.act(async () => {
      captured.current!.handleCurrencySelect("USD");
      await flush();
    });

    expect(userAPI.hasAnyTransactions).not.toHaveBeenCalled();
    expect(userAPI.updateCurrency).not.toHaveBeenCalled();
  });
});

describe("Profile financial reporting states", () => {
  it("failed initial income load is unavailable rather than recorded zero", async () => {
    mockedGetMonthlyIncome.mockRejectedValue(new Error("unavailable"));
    const { captured } = setup();
    await renderer.act(async () => { await flush(); });
    expect(captured.current!.actualMonthlyIncome).toBeNull();
    expect(captured.current!.monthlyIncomeError).toBe(true);
    mockedGetMonthlyIncome.mockResolvedValue({ data: { monthlyIncome: 0, actualMonthlyIncome: 0 } });
    await renderer.act(async () => { await captured.current!.onRefresh(); });
    expect(captured.current!.actualMonthlyIncome).toBe(0);
    expect(captured.current!.monthlyIncomeError).toBe(false);
  });
  it("failed refresh retains known income with an explicit error state", async () => {
    const { captured } = setup();
    await renderer.act(async () => { await flush(); });
    mockedGetMonthlyIncome.mockRejectedValue(new Error("unavailable"));
    await renderer.act(async () => { await captured.current!.onRefresh(); });
    expect(captured.current!.actualMonthlyIncome).toBe(2900);
    expect(captured.current!.monthlyIncomeError).toBe(true);
  });
  it("a late response cannot replace another selected month's income", async () => {
    const old = gatedResponse({ data: { monthlyIncome: 1000, actualMonthlyIncome: 1000 } });
    mockedGetMonthlyIncome.mockReturnValueOnce(old.promise);
    const { captured, store } = setup();
    mockedGetMonthlyIncome.mockResolvedValue({ data: { monthlyIncome: 5000, actualMonthlyIncome: 5000 } });
    await renderer.act(async () => { store.dispatch(setMonthYear({ month: 1, year: 2026 })); await flush(); });
    expect(captured.current!.actualMonthlyIncome).toBe(5000);
    await renderer.act(async () => { old.resolve({ data: { monthlyIncome: 1000, actualMonthlyIncome: 1000 } }); await flush(); });
    expect(captured.current!.actualMonthlyIncome).toBe(5000);
  });
});


it("Profile exposes the saved System preference while rendering the effective palette and persists changes", async () => {
  const { captured, store } = setup();
  await renderer.act(async () => { await flush(); });
  expect(captured.current!.selectedTheme).toBe("System");
  for (const name of ["Dark", "Light", "System"] as const) {
    await renderer.act(async () => { await captured.current!.handleThemeSelect(name); });
    expect(store.getState().theme.selectedTheme).toBe(name);
    expect(captured.current!.selectedTheme).toBe(name);
    expect(require("@/utils/profile/profileService").persistTheme).toHaveBeenLastCalledWith(name);
  }
});

it("failed bank refresh keeps known connections and retry recovers", async () => {
  mockedFetchItems.mockResolvedValue({ data: { items: [{id:"bank-1",institutionName:"Test bank"}] } });
  const { captured } = setup();
  await renderer.act(async () => { await flush(); });
  mockedFetchItems.mockRejectedValueOnce(new Error("offline"));
  await renderer.act(async () => { await captured.current!.retryItems(); });
  expect(captured.current!.itemsError).toBe(true);
  expect(captured.current!.plaidItems[0].id).toBe("bank-1");
  mockedFetchItems.mockResolvedValue({data:{items:[]}});
  await renderer.act(async () => { await captured.current!.retryItems(); });
  expect(captured.current!.itemsError).toBe(false);
  expect(captured.current!.plaidItems).toEqual([]);
});
