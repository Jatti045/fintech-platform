import MonthPicker from "@/components/calendar/MonthPicker";
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { Text, TextInput, TouchableOpacity } from "react-native";
import themeReducer, { setTheme } from "@/store/slices/themeSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import { THEME_PALETTES } from "@/constants/ThemePalettes";
import TransactionHeader from "@/components/transaction/TransactionHeader";
import TransactionRow from "@/components/transaction/TxRow";
import FilterTransaction from "@/components/transaction/TxFilterOpt";
import TransactionFeedback from "@/components/transaction/TransactionFeedback";
import ListFooter from "@/components/transaction/TxFooter";
import {
  ledgerTransactions,
  ledgerBudgets,
} from "../../test-fixtures/transactionsDesign";
import { formatCurrency } from "@/utils/helper";

jest.mock("@/hooks/useRedux", () => ({
  ...jest.requireActual("@/hooks/useRedux"),
  useBudgets: () => [],
}));
jest.mock("@/components/global/SwipeableRow", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
function mount(element: React.ReactElement, theme = "Light") {
  const store = configureStore({
    reducer: { theme: themeReducer, calendar: calendarReducer },
  });
  store.dispatch(setTheme(theme));
  store.dispatch(setMonthYear({ month: 1, year: 2026 }));
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Provider store={store}>{element}</Provider>);
  });
  return { tree, store };
}
function button(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.props.accessibilityLabel === label)!;
}
function texts(tree: renderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .map((n) =>
      Array.isArray(n.props.children)
        ? n.props.children.join("")
        : String(n.props.children),
    )
    .join(" | ");
}

it.each(["Light", "Dark"])(
  "keeps the picker beside the title above the subtitle and search in %s",
  (theme) => {
    const change = jest.fn();
    const { tree, store } = mount(
      <TransactionHeader
        displayTransactions={[]}
        month={1}
        year={2026}
        monthlyIncome={0}
        actualIncome={0}
        expectedIncome={0}
        currencyCode="CAD"
        searchQuery="coffee"
        onSearchChange={change}
        budgets={ledgerBudgets}
        filterCategoryId="all"
        onFilterCategoryChange={jest.fn()}
        minAmount=""
        onMinAmountChange={jest.fn()}
        maxAmount=""
        onMaxAmountChange={jest.fn()}
        onClearFilters={jest.fn()}
      />,
      theme,
    );
    const title = tree.root
      .findAllByType(Text)
      .find((node) => node.props.children === "Transactions")!;
    const picker = tree.root.findByType(MonthPicker);
    const titleRow = title.parent!.parent!;
    expect(titleRow.props.style).toMatchObject({
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    });
    expect(titleRow.findByType(MonthPicker)).toBe(picker);
    expect(title.props.style).toMatchObject({ flexShrink: 1, maxWidth: "60%" });
    expect(picker.parent!.props.style).toMatchObject({ flex: 1, minWidth: 0 });
    const headingBlock = titleRow.parent!;
    const subtitle = tree.root
      .findAllByType(Text)
      .find((node) =>
        Array.isArray(node.props.children) &&
        node.props.children.join("") === "Your money, in detail · CAD",
      );
    expect(headingBlock.children[0]).toBe(titleRow);
    expect(headingBlock.children[1]).toBe(subtitle);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    act(() => {
      button(tree, "Clear search").props.onPress();
    });
    expect(change).toHaveBeenCalledWith("");

    // The inline picker receives less space than the former full-width row.
    // Exercise its real layout/scroll handlers rather than bypassing onChange.
    const reportingMonth = tree.root
      .findAllByType("View" as any)
      .find((node) => node.props.accessibilityRole === "adjustable")!;
    for (const width of [110, 220]) {
      act(() => {
        reportingMonth.props.onLayout({ nativeEvent: { layout: { width } } });
      });
      const list = tree.root.findByType("VirtualizedList" as any).props;
      expect(list.contentContainerStyle.paddingHorizontal).toBe(
        (width - list.snapToInterval) / 2,
      );
    }
    const list = tree.root.findByType("VirtualizedList" as any).props;
    const event = {
      nativeEvent: {
        contentOffset: {
          x: (list.initialScrollIndex + 2) * list.snapToInterval,
        },
      },
    };
    act(() => {
      list.onScrollBeginDrag();
      list.onScrollEndDrag(event);
      list.onMomentumScrollBegin();
      list.onMomentumScrollEnd(event);
    });
    expect(store.getState().calendar).toMatchObject({ month: 11, year: 2025 });
    act(() => tree.unmount());
  },
);
it.each(["Light", "Dark"])(
  "keeps filter states visible, selects a category, and resets ranges in %s",
  (theme) => {
    function Harness() {
      const [category, setCategory] = useState("all");
      const [min, setMin] = useState("");
      const [max, setMax] = useState("");
      return (
        <FilterTransaction
          budgets={ledgerBudgets}
          filterCategoryId={category}
          setFilterCategoryId={setCategory}
          minAmount={min}
          setMinAmount={setMin}
          maxAmount={max}
          setMaxAmount={setMax}
          clearFilters={() => {
            setCategory("all");
            setMin("");
            setMax("");
          }}
        />
      );
    }
    const { tree } = mount(<Harness />, theme);
    act(() => {
      button(tree, "Amount filters").props.onPress();
    });
    const input = tree.root
      .findAllByType(TextInput)
      .find((n) => n.props.accessibilityLabel === "Minimum amount")!;
    act(() => {
      input.props.onChangeText("25");
    });
    expect(
      button(tree, "Amount filters").props.accessibilityState.selected,
    ).toBe(true);
    act(() => {
      button(tree, "More category filters").props.onPress();
    });
    act(() => {
      button(tree, "Select Groceries").props.onPress();
    });
    expect(
      button(tree, "More category filters").props.accessibilityState.selected,
    ).toBe(true);
    act(() => {
      button(tree, "Clear filters").props.onPress();
    });
    expect(
      button(tree, "All categories").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      button(tree, "Amount filters").props.accessibilityState.selected,
    ).toBe(false);
    act(() => {
      tree.unmount();
    });
  },
);
it.each(["Light", "Dark"])(
  "preserves transfer direction, currency references, and row actions in %s",
  (theme) => {
    const edit = jest.fn(),
      remove = jest.fn();
    const { tree } = mount(
      <>
        {ledgerTransactions.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} onEdit={edit} onDelete={remove} />
        ))}
      </>,
      theme,
    );
    const output = texts(tree);
    expect(output).toContain(`−${formatCurrency(250, "CAD")}`);
    expect(output).toContain(`+${formatCurrency(250, "CAD")}`);
    expect(output).toContain(`−${formatCurrency(18.45, "USD")}`);
    expect(output).toContain(`≈ ${formatCurrency(25.4, "CAD")} (CAD)`);
    const row = tree.root
      .findAllByType(TouchableOpacity)
      .find((n) =>
        n.props.accessibilityLabel?.startsWith("Checking to savings,"),
      )!;
    expect(row.props.accessibilityLabel).toContain("Transfer");
    act(() => {
      row.props.onPress();
    });
    expect(edit).toHaveBeenCalledWith(ledgerTransactions[3]);
    act(() => {
      row.props.onAccessibilityAction({
        nativeEvent: { actionName: "delete" },
      });
    });
    expect(remove).toHaveBeenCalledWith("test-out");
    const palette =
      theme === "Light" ? THEME_PALETTES.LIGHT : THEME_PALETTES.DARK;
    const transferAmount = tree.root
      .findAllByType(Text)
      .find((n) => n.props.children === `−${formatCurrency(250, "CAD")}`)!;
    expect(transferAmount.props.style.color).toBe(palette.textSecondary);
    act(() => {
      tree.unmount();
    });
  },
);
it("allows full large amounts and exposes the complete merchant name to accessibility", () => {
  const tx = {
    ...ledgerTransactions[0],
    amount: 1234567890.12,
    displayAmount: 1234567890.12,
  };
  const { tree } = mount(
    <TransactionRow tx={tx} onEdit={jest.fn()} onDelete={jest.fn()} />,
  );
  const amount = tree.root
    .findAllByType(Text)
    .find((n) => n.props.children === `−${formatCurrency(tx.amount, "CAD")}`)!;
  expect(amount.props.numberOfLines).toBeUndefined();
  expect(
    tree.root.findAllByType(TouchableOpacity)[0].props.accessibilityLabel,
  ).toContain(tx.name);
  act(() => {
    tree.unmount();
  });
});
it("separates failure from empty results and wires retry and load-more actions", () => {
  const retry = jest.fn(),
    load = jest.fn();
  const { tree } = mount(
    <>
      <TransactionFeedback theme={THEME_PALETTES.LIGHT} error onRetry={retry} />
      <ListFooter
        hasNextPage
        isLoadingMore={false}
        hasTransactions
        onLoadMore={load}
      />
    </>,
  );
  expect(texts(tree)).toContain("Could not load transactions.");
  expect(texts(tree)).not.toContain("No transactions match");
  act(() => {
    button(tree, "Retry transactions").props.onPress();
    button(tree, "Load more transactions").props.onPress();
  });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1);
  act(() => {
    tree.unmount();
  });
});

it("centralizes categories in the sheet and keeps Category immediately before Amount", () => {
  const select = jest.fn();
  const { tree } = mount(<FilterTransaction budgets={ledgerBudgets}
    categories={["Freelance income", "Custom pottery", "Groceries"]}
    filterCategoryId="all" setFilterCategoryId={select}
    minAmount="" setMinAmount={jest.fn()} maxAmount="" setMaxAmount={jest.fn()} clearFilters={jest.fn()} />);
  expect(button(tree, "Filter by Groceries")).toBeUndefined();
  expect(button(tree, "Filter by Transfer out")).toBeUndefined();
  const category = button(tree, "More category filters");
  const amount = button(tree, "Amount filters");
  expect(category.parent!.parent).toBe(amount.parent!.parent);
  const row = category.parent!.parent!;
  const controls = row.findAllByType(TouchableOpacity).map((n) => n.props.accessibilityLabel);
  expect(controls).toEqual(["More category filters", "Amount filters"]);
  act(() => category.props.onPress());
  for (const name of ["Groceries", "Freelance income", "Custom pottery", "Transfers out", "Transfers in"])
    expect(button(tree, `Select ${name}`)).toBeDefined();
  expect(tree.root.findAllByType(TouchableOpacity).filter((n) => n.props.accessibilityLabel === "Select Groceries")).toHaveLength(1);
  act(() => button(tree, "Select Freelance income").props.onPress());
  expect(select).toHaveBeenCalledWith("category:freelance income");
  act(() => tree.unmount());
});

it("shows category loading, empty, and retry states", () => {
  const retry = jest.fn();
  const props = { budgets: [], filterCategoryId: "all", setFilterCategoryId: jest.fn(),
    minAmount: "", setMinAmount: jest.fn(), maxAmount: "", setMaxAmount: jest.fn(), clearFilters: jest.fn() };
  const { tree } = mount(<FilterTransaction {...props} categoriesLoading />);
  act(() => button(tree, "More category filters").props.onPress());
  expect(tree.root.findAll((n) => n.props.accessibilityLabel === "Loading categories").length).toBeGreaterThan(0);
  act(() => tree.unmount());
  const failed = mount(<FilterTransaction {...props} categoriesError onRetryCategories={retry} />).tree;
  act(() => button(failed, "More category filters").props.onPress());
  act(() => button(failed, "Retry categories").props.onPress());
  expect(retry).toHaveBeenCalled();
  act(() => failed.unmount());
  const empty = mount(<FilterTransaction {...props} />).tree;
  act(() => button(empty, "More category filters").props.onPress());
  expect(texts(empty)).toContain("No categories for this month yet");
  act(() => empty.unmount());
});
