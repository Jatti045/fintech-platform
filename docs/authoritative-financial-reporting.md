# Authoritative financial reporting

## Confirmed causes and architecture

Home mixed full monthly headline totals with the first transaction page for its trend. MonthlyOverview substituted decorative bars for absent history and hid negative remaining amounts. FinancialMetrics also had fixed +12%, +8% and +4% comparisons. BudgetContent invented income from limits/spending and recomputed monthly figures from searched rows. Profile formatted income in USD and treated failed/unfinished reads as zero.

The authenticated `GET /api/financial-summary/report?month=1&year=2026` contract now supplies the complete report (months are zero-based). Home and Budget use the same RTK Query entry. Browsing remains paginated and independent. The legacy `/api/financial-summary` endpoint remains compatible with existing callers; both services share the existing effective-income policy.

## Metrics and consistency

- Reporting periods use half-open UTC month boundaries, including leap years and December/January.
- Gross expenses sum positive EXPENSE amounts; expense credits sum the magnitudes of negative EXPENSE amounts. Net spending is signed expenses less credits. Refunds do not become income.
- All internal transfers are excluded from reporting totals and the eligible transaction count.
- Actual income sums non-transfer INCOME rows. Expected income uses the latest baseline at or before the selected month. An explicit zero baseline is distinguished from an absent baseline.
- The existing effective-income policy remains actual income when positive, otherwise expected income. It is labeled ACTUAL, EXPECTED or UNCONFIGURED; this is not an account balance or cash-flow forecast.
- Remaining income is effective income minus net spending. Budget remaining is limit minus linked net expenses. Negative amounts remain visible.
- Daily/category gross, credits and net totals reconcile with the monthly totals. Numeric aggregation avoids binary summation drift. For legacy sub-cent values, rounding residuals are allocated deterministically by fractional remainder rather than inventing additional activity. Stored amounts and conversion are unchanged; the application retains its two-decimal reporting convention.
- Budget utilization is computed from linked transaction data, rather than a potentially inconsistent denormalized spent field. Whole-month spending can include expenses without a budget; category budget subtotals are labeled separately.
- Previous-month comparison uses recorded income and net spending. Percentages are absent when the prior value is non-positive. No fixed comparison percentages remain in active metrics.

The report service uses PostgreSQL REPEATABLE READ for its user, transaction, budget, expected-income and previous-period reads. It does not call the cached legacy summary method. A real concurrent-writer integration test verifies that changes committed midway do not mix report snapshots. `generatedAt` records the report's generation start; it is not the bank's last synchronization timestamp.

## Frontend states and refresh

No report means loading, failure, or unavailable UI, with refresh controls and no zero-valued financial result. A successful empty report explicitly identifies no recorded income/spending. Zero income is a valid result. Cached data remains visible after a refresh failure, accompanied by a warning and generation timestamp. Reports older than one minute are labeled cached; foreground polling and app activation refresh them. Polling pauses while the app is inactive/backgrounded.

Budget search changes rows and explicitly labeled matching subtotals, including a zero-match search. It does not change monthly spending, limits, or income. Budget rows, halo and income cards use the report snapshot. Income assumptions are labeled independently from recorded income. Profile's income editor uses the account currency and differentiates unavailable, loading, recorded zero, and retained cached income; request generations prevent late reads from replacing another selected month's values.

Transaction and budget mutations invalidate reports through existing Summary/Budgets tags. Transaction creation also invalidates active reports across periods because the subsequent month's comparison can change. Editing income invalidates all Summary tags because the baseline carries forward. Observing a new bank lastSyncedAt invalidates reports; periodic reads pick up background changes even without an item-status fetch. No new AI generation triggers were introduced.

## Deployment and limits

Deploy the backend endpoint before updated clients. No database migrations, dependencies, new infrastructure, or stored financial rewrites are required. The new report is deliberately uncached server-side; it performs grouped PostgreSQL queries over the requested and previous month using the existing user/date index. Reports are held in the existing user-session RTK Query memory cache, with session reset preserving isolation.

Financial data can change between separate requests. Foreground polling bounds automatic discovery, and timestamps/stale labels expose retained snapshots. Bank data freshness still depends on the existing synchronization system. No physical-device, live-bank or production deployment validation is claimed. Dormant legacy chart components were not rewritten.

## Verification

Tests exercise complete months above 20 records, page/search independence, category/daily reconciliation, refunds, transfers, explicit zero versus missing income, empty months, negative remaining amounts, request failures, stale/refreshed cache, leap years, year boundaries, transaction edits/deletion, ownership, concurrent writes, budget mutation invalidation, and observed bank-sync completion. Existing automated suites and platform exports are run before commit; final verification passed: Java 17 `mvn clean verify` discovered 640 tests (629 passed, 11 skipped); 49 client suites / 414 tests passed; TypeScript passed; lint reported zero errors and four pre-existing BudgetModal/TxModal hook warnings; Expo exported web, iOS and Android successfully. Jest retains its existing `--forceExit` workaround for open handles.

## Complete modified file manifest

The pre-existing `client/app.json` version changes are excluded.

- `client/__tests__/budget/BudgetScreen.test.tsx`
- `client/__tests__/home/Index.test.tsx`
- `client/__tests__/home/MonthlyOverviewTransfers.test.tsx`
- `client/__tests__/home/useHomeScreen.test.tsx`
- `client/__tests__/profile/useProfile.test.tsx`
- `client/__tests__/reporting/reportingCache.test.ts`
- `client/__tests__/reporting/reportingUI.test.tsx`
- `client/api/financialSummary.ts`
- `client/app/(tabs)/index.tsx`
- `client/app/(tabs)/profile.tsx`
- `client/components/budget/BudgetContent.tsx`
- `client/components/budget/BudgetHalo.tsx`
- `client/components/budget/BudgetIncomeSummary.tsx`
- `client/components/budget/BudgetReservoirRow.tsx`
- `client/components/home/FinancialMetrics.tsx`
- `client/components/home/MonthlyOverview.tsx`
- `client/components/profile/MonthlyIncome.tsx`
- `client/components/reporting/ReportStatus.tsx`
- `client/hooks/budget/useBudgetScreen.ts`
- `client/hooks/home/useHomeScreen.ts`
- `client/hooks/profile/useProfile.ts`
- `client/hooks/reporting/useFinancialReport.ts`
- `client/store/api/apiSlice.ts`
- `client/store/slices/plaidSlice.ts`
- `client/types/financialSummary/types.ts`
- `docs/authoritative-financial-reporting.md`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/controller/FinancialSummaryController.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/dto/financialSummary/FinancialReportResponse.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/FinancialReportService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/FinancialSummaryService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/IncomeCalculationService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/UserService.java`
- `fintech-api/src/test/java/com/fintechapp/fintech_api/integration/controller/FinancialReportIntegrationTest.java`
