import React from "react";
import {RefreshControl, SectionList} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useTheme} from "@/hooks/useRedux";
import {useTransactionScreen} from "@/hooks/transaction/useTransactionScreen";
import TransactionHeader from "@/components/transaction/TransactionHeader";
import TransactionModal from "@/components/transaction/TxModal";
import AddNewTransactionButton from "@/components/transaction/AddTxButton";
import Loader from "@/utils/loader";
import LastSynced from "@/components/plaid/LastSynced";
import type {GroupedSection, TransactionItem} from "@/types/transaction/types";

/**
 * TransactionScreen is a composition/orchestration layer only:
 *
 *  - `useTransactionScreen` owns all screen orchestration (selectors, search,
 *    filters, load-more, refresh, modal state, loader state, render callbacks)
 *  - `TransactionHeader` is the fixed top content (title + FlowHeader +
 *    search + filters)
 *  - `TransactionModal` / `AddNewTransactionButton` / `Loader` are the
 *    self-contained chrome
 */
export default function TransactionScreen() {
    const {THEME} = useTheme();

    const {
        displayTransactions,
        budgets,
        monthlyIncome,
        actualIncome,
        expectedIncome,
        activeCurrency,
        month,
        year,
        searchQuery,
        handleSearchQueryChange,
        isSearching,
        filterCategoryId,
        setFilterCategoryId,
        minAmount,
        setMinAmount,
        maxAmount,
        setMaxAmount,
        clearFilters,
        sectionsWithTotals,
        keyExtractor,
        renderSectionHeader,
        renderItem,
        listFooter,
        listEmpty,
        refreshing,
        onRefresh,
        openSheet,
        setOpenSheet,
        editingTransaction,
        handleModalClose,
        isLoaderVisible,
        loaderMessage,
    } = useTransactionScreen();

    return (
        <SafeAreaView
            edges={["left", "right"]}
            style={{backgroundColor: THEME.background, flex: 1}}
            className="px-4"
        >
            <TransactionHeader
                displayTransactions={displayTransactions}
                month={month}
                year={year}
                monthlyIncome={monthlyIncome}
                actualIncome={actualIncome}
                expectedIncome={expectedIncome}
                currencyCode={activeCurrency}
                searchQuery={searchQuery}
                onSearchChange={handleSearchQueryChange}
                budgets={budgets}
                filterCategoryId={filterCategoryId}
                onFilterCategoryChange={setFilterCategoryId}
                minAmount={minAmount}
                onMinAmountChange={setMinAmount}
                maxAmount={maxAmount}
                onMaxAmountChange={setMaxAmount}
                onClearFilters={clearFilters}
            />

            <SectionList<TransactionItem, GroupedSection>
                sections={sectionsWithTotals}
                keyExtractor={keyExtractor}
                renderSectionHeader={renderSectionHeader}
                renderItem={renderItem}
                contentContainerStyle={{paddingBottom: 120, paddingTop: 8}}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={listEmpty}
                ListFooterComponent={listFooter}
                refreshControl={
                    <RefreshControl
                        refreshing={isSearching ? false : refreshing}
                        onRefresh={onRefresh}
                        progressBackgroundColor={THEME.background}
                        colors={[THEME.primary]}
                    />
                }
                ListHeaderComponent={<LastSynced/>}
            />

            {/* Create / Edit modal — self-contained via useTransactionOperations */}
            <TransactionModal
                openSheet={openSheet}
                setOpenSheet={setOpenSheet}
                editingTransaction={editingTransaction}
                onClose={handleModalClose}
            />

            {/* Floating action button */}
            <AddNewTransactionButton setOpenSheet={setOpenSheet}/>

            {/* Full-screen loader overlay */}
            {isLoaderVisible ? <Loader msg={loaderMessage}/> : null}
        </SafeAreaView>
    );
}
