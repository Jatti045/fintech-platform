/**
 * BudgetScreen integration tests.
 *
 * Verifies the refactored screen composition: loading / empty / search /
 * main-content states, the create + edit modals, delete wiring, and
 * pull-to-refresh.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import budgetApi from "@/api/budget";
import BudgetScreen from "@/app/(tabs)/budget";
import budgetReducer, { fetchBudgets } from "@/store/slices/budgetSlice";
import transactionReducerDefault from "@/store/slices/transactionSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import type { IBudget } from "@/types/budget/types";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;
const activityIndicatorMock = ActivityIndicator as unknown as jest.Mock;

jest.mock("@/api/budget", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedFetchAll = budgetApi.fetchAll as jest.Mock;

const makeBudget = (overrides: Partial<IBudget> = {}): IBudget => ({
  id: "b-1",
  date: new Date("2026-02-01"),
  category: "Food",
  limit: 500,
  spent: 100,
  userId: "user-1",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

function makeStore() {
  return configureStore({
    reducer: {
      budget: budgetReducer,
      transaction: transactionReducerDefault,
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
    },
  });
}

async function setup(
  initialBudgets: IBudget[] = [],
  seed?: (store: ReturnType<typeof makeStore>) => void,
) {
  const store = makeStore();
  if (initialBudgets.length > 0) {
    store.dispatch({
      type: fetchBudgets.fulfilled.type,
      payload: initialBudgets,
    });
  }
  seed?.(store);

  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <BudgetScreen />
        </AlertProvider>
      </Provider>,
    );
  });

  // Let the display-amounts async effect settle.
  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { tree, store };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function lastProps(
  mock: jest.Mock,
  matcher: (props: Record<string, unknown>) => boolean,
): Record<string, any> | undefined {
  const calls = mock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && matcher(props)) return props;
  }
  return undefined;
}

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

const searchInput = () =>
  lastProps(
    textInputMock,
    (props) => props.placeholder === "Search budgets...",
  );

const newBudgetButton = () =>
  lastProps(
    touchableOpacityMock,
    (props) => props.accessibilityLabel === "New Budget",
  );

/**
 * The screen passes <RefreshControl> as a prop to the native ScrollView, so
 * the host ScrollView mock receives the element (never rendered as a child).
 * Read the element's props to reach the refresh handler.
 */
const refreshControlProps = () => {
  const scrollViewProps = (ScrollView as unknown as jest.Mock).mock.calls.at(
    -1,
  )?.[0];
  return scrollViewProps?.refreshControl?.props as
    | { onRefresh: () => void; refreshing: boolean }
    | undefined;
};

beforeEach(() => {
  mockedFetchAll.mockReset();
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
  activityIndicatorMock.mockClear();
});

describe("BudgetScreen", () => {
  it("renders the loading state before budgets arrive", async () => {
    await setup([], (store) => {
      store.dispatch({ type: fetchBudgets.pending.type });
    });

    expect(activityIndicatorMock.mock.calls.length).toBeGreaterThan(0);
  });

  it("renders the empty state when there are no budgets", async () => {
    await setup();

    expect(renderedText("No budgets yet")).toBe(true);
    expect(renderedText("Create your first budget to track spending by category.")).toBe(
      true,
    );
  });

  it("renders the header, halo, trend card, and budget rows", async () => {
    await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    expect(renderedText("Budgets")).toBe(true);
    expect(renderedText("Limits used")).toBe(true); // BudgetHalo vitals
    expect(renderedText("Daily left")).toBe(true); // BudgetTrendCard vitals
    expect(renderedText("Channels")).toBe(true);
    expect(renderedText("Food")).toBe(true);
    expect(renderedText("Transport")).toBe(true);
  });

  it("filters the rows via the search bar", async () => {
    await setup([
      makeBudget({ id: "a", category: "Food" }),
      makeBudget({ id: "b", category: "Transport" }),
    ]);

    // Only consider Text renders after this point.
    textMock.mockClear();

    renderer.act(() => {
      searchInput()!.onChangeText("Transport");
    });

    expect(renderedText("Transport")).toBe(true);
    expect(renderedText("Food")).toBe(false);
  });

  it("shows the no-results message when the search has no matches", async () => {
    await setup([makeBudget({ id: "a", category: "Food" })]);

    textMock.mockClear();

    renderer.act(() => {
      searchInput()!.onChangeText("zzz");
    });

    expect(renderedText("No budgets match")).toBe(true);
  });

  it("opens the create modal via the New Budget button", async () => {
    await setup([makeBudget()]);

    renderer.act(() => {
      newBudgetButton()!.onPress();
    });

    expect(renderedText("Create Budget")).toBe(true);
  });

  it("opens the edit modal via a row's Edit action", async () => {
    await setup([makeBudget({ id: "a", category: "Food" })]);

    const edit = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Edit",
    );
    renderer.act(() => {
      edit!.onPress();
    });

    expect(renderedText("Update Budget")).toBe(true);
  });

  it("triggers the delete confirmation via a row's Delete action", async () => {
    await setup([makeBudget({ id: "a", category: "Food" })]);

    const del = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Delete",
    );
    renderer.act(() => {
      del!.onPress();
    });

    expect(renderedText("Delete Budget")).toBe(true);
  });

  it("refreshes by dispatching fetchBudgets", async () => {
    mockedFetchAll.mockResolvedValue({ data: [] });
    await setup([makeBudget()]);

    const refresh = refreshControlProps();
    expect(refresh).toBeDefined();

    await renderer.act(async () => {
      await refresh!.onRefresh();
      await flush();
    });

    expect(mockedFetchAll).toHaveBeenCalled();
  });
});

