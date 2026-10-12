# Persistent categorization and transaction rules

## Investigation and architecture

Previously, manual transaction edits and Plaid imports wrote the same `name`, `category`, and `budget` fields. A subsequent modified provider transaction replaced the name/category and resolved a monthly provider-category budget. Spending adjustments were atomic, but the user's classification intent was not represented separately. There was no reusable rule model.

The effective fields remain compatible with existing transaction APIs, reports, recurring-payment detection, budget suggestions, and frontend components. New metadata records provider facts, explicit user overrides, historical classifications of unknown provenance, and the applied rule's action snapshot. Amount, date, currency normalization, pending status, refund evidence, and transfer evidence remain provider financial facts governed by the existing ingestion services.

No reconnect identity, sync job, distributed item lease, or cursor fencing implementation changes. The narrow pending-to-posted integration preserves classification choices when a proven pending row is removed before its posted replacement arrives.

## Classification policy

Each field resolves independently: explicit transaction override, winning rule action, provider value, then fallback. Historical rows have an additional conservative preservation layer below rule actions: their existing effective fields remain until an explicit history application or reset changes them. This does not claim that their classifications were originally user choices.

- Manual creation records explicit name/category choices and an owned budget anchor when applicable.
- Manual edits set overrides only for supplied classification fields. Source amount/date changes still update financial totals.
- Rules are ordered by ascending priority, creation time, then ID. The first matching rule wins as a whole; rules are not combined into a script.
- Applied rule actions and revision are snapshotted on each transaction. Editing, disabling, or deleting a rule affects future classification; it does not silently rewrite existing history on the next bank update.
- Automatic selection only considers rule revisions effective no later than the imported transaction's creation. Creation/revision timing uses the database clock for both rules and native imports, so a long-running transaction or a different application's clock does not change eligibility.
- A provider reset clears overrides and snapshots and bypasses rules for that transaction. Unknown provider categories become Uncategorized. The API also supports `automatic=true` to opt back into automatic classification.
- Rule budget actions target a monthly budget category. Explicit budget overrides retain the owned budget ID within its month and resolve the same category in another month. Missing monthly budgets are created with a zero spending limit. No category-ID API migration is required.
- Income and transfers never acquire a budget. Negative expense credits retain their sign.

## Matching and safe historical application

Supported conditions: merchant or description; exact text, normalized exact text, or normalized contains; optional income/expense direction, imported financial-account scope, and provider category. Normalization uses Unicode NFKC, lower case, and punctuation-to-space conversion. User-supplied patterns are never executed as regular expressions or scripts. Merchant matching uses retained provider name when available, otherwise the existing display name; unavailable historical provider metadata is not reconstructed.

Rule creation is future-only. History changes require preview followed by explicit apply. Preview and execution share matching and classification resolution. Preview exposes all matching rule IDs, the winning rule, protected explicit choices, and resulting classifications. A lower-priority rule or a transaction whose rules are bypassed previews unchanged values.

A SHA-256 preview token binds the user, rule revisions, ordered rule set, matches, and transaction facts/choices. Apply reacquires the user lock and recomputes the preview; stale previews return 409 without partial changes. History applications are bounded to 500 matches; users must narrow broader rules. Users may create at most 100 rules.

Each application persists before-state and an after-fingerprint. Undo is transactional and idempotent, restores classification metadata without automatically selecting a new rule, and refuses to replace subsequent transaction edits or a removed/renamed original budget. Rule deletion does not delete application history or existing action snapshots. The UI displays the most recent 20 applications.

## Financial and concurrency safeguards

All classification writers use the existing PostgreSQL user-row lock, including direct ingestion entry points. Rule edits, manual edits, imports, history apply, and undo serialize for the same user across application instances. Ownership is checked for every rule, transaction, application, budget anchor, and optional account scope.

The existing atomic ingestion amount adjustments remain when classification retains the same budget. Classification budget moves flush the transaction first and rebuild old/new budget spending from signed, non-transfer expense rows. Repeated execution cannot add the same transaction's spending twice. Classification changes and cursor advancement remain within the existing persistence transaction.

Pending classification handoffs are keyed by user, Plaid item, financial account, and the original pending transaction ID. Only Plaid's explicit pending pointer in the same scope can consume a handoff. No fuzzy amount/name identity matching is introduced. Handoffs are metadata-only, are consumed atomically, and are not retained if an existing posted replacement already carries the pointer. Unmatched handoffs currently remain until account deletion; a time-based retention policy is not implemented.

Backend summary/recurring caches are evicted after commit. Frontend apply, undo, and reset are RTK Query mutations. They refresh every cached transaction scope from page one, cancel earlier in-flight page responses, and invalidate budget, summary/reporting, recurring, and suggestion queries. Active transaction browsing returns to page one. This avoids appending a stale higher page after history changes. Classification actions never request AI insight generation.

## API

All endpoints use the authenticated principal, under `/api`:

| Method | Route | Purpose |
| --- | --- | --- |
| GET / POST | `/categorization-rules` | List / create future rule |
| PATCH / DELETE | `/categorization-rules/{id}` | Edit / delete with revision protection |
| POST | `/categorization-rules/{id}/preview` | Preview history and receive token |
| POST | `/categorization-rules/{id}/apply` | Apply a supplied preview token |
| GET | `/categorization-rules/applications` | Recent applications |
| POST | `/categorization-rules/applications/{id}/undo` | Guarded undo |
| GET | `/categorization-rules/accounts` | Owned imported account scopes |
| POST | `/transactions/{id}/classification/reset` | Reset to provider, optionally automatic |

Transaction responses include additive `classification` metadata: provider name/category, per-field provenance, rule ID/revision/title, historical-preservation flag, rule-bypass preference, and financial-account ID. Existing effective transaction fields and clients remain compatible.

## Frontend

Profile has a Transaction rules entry. The manager supports create/edit, deterministic priority, matching conditions and scopes, actions, enable/disable/delete, preview, explicit history apply, persisted undo, and visible loading/error/conflict feedback. Transaction editing explains classification provenance, retains the existing transaction-only update, can seed a future rule from the transaction, and can reset classification to bank data.

The categorization model uses the existing category strings and monthly budget conventions. Rule actions do not create spending limits, modify financial facts, or overwrite transaction overrides. Provider reset intentionally clears all three classification overrides; it is not an undo of a source amount/date change.

## Schema and rollout

`V24__transaction_categorization_rules.sql` adds classification metadata and the `categorization_rules`, `rule_applications`, and `pending_classification_handoffs` tables. Existing effective name/category/budget links/spending are preserved. Legacy name/category/budget-category backups are stored; provider data and explicit override fields are left unknown. The migration is idempotent, and future rows default to non-legacy. New data is removed through the existing user-account deletion workflow.

The application currently applies schema patches at startup rather than using an enabled Flyway runner. V24 is wired into that same runner. Before deploying, back up the database and rehearse V24 on a staging copy. Apply V24 before allowing a Hibernate `update` schema policy or new traffic to introduce defaults onto an old database. Quiesce old application writers during rollout: old versions cannot preserve the new override fields. Deploy the backend first, then the client. Do not roll back to an old writer while allowing ongoing Plaid synchronization or manual classification edits. No new dependencies, infrastructure, credentials, or configuration variables are required.

## Verification and limitations

Automated tests exercise real PostgreSQL ingestion, rules, history application/undo, migration preservation/idempotency, refunds/transfers, pending replacement, user isolation, ownership endpoints, and concurrent committed writers. Frontend tests exercise management, previews/tokens/conflicts, safe reset, future-only save, undo, cache replacement, and stale response cancellation. Full backend/frontend suites, TypeScript, lint, and all-platform Expo bundles are run before commit. Final verification: backend `mvn clean verify` discovered 658 tests (647 passed, 11 skipped, zero failures/errors); frontend Jest passed 422 tests in 50 suites; TypeScript passed; lint had zero errors and four pre-existing hook warnings; Android/iOS/web Expo export passed. A full suite was rerun after correcting financial, future-only timing, and cache-refresh regressions.

No live Plaid, production deployment/migration, physical-device, or actual multi-process restart verification is claimed. Concurrency verification uses separate threads and database transactions. Preview/account-scope lookup currently reads a user's history and performs matching in application memory; 500-match/100-rule limits bound application changes but not the total history scanned. Very large histories may need indexed candidate queries or chunked jobs later. An unmatched handoff has no scheduled expiry, and application audit history has no pruning policy yet. Rule disabling/deletion deliberately leaves already-applied classifications stable.

## Changed files

- `client/__tests__/apiSlice.test.ts`
- `client/__tests__/rules/RulesManager.test.tsx`
- `client/__tests__/transaction/TxModalReassignment.test.tsx`
- `client/api/categorizationRules.ts`
- `client/app/(tabs)/profile.tsx`
- `client/components/rules/RulesManager.tsx`
- `client/components/transaction/TxModal.tsx`
- `client/hooks/transaction/useTransactionSearch.ts`
- `client/store/api/apiSlice.ts`
- `client/types/transaction/types.ts`
- `docs/transaction-categorization-rules.md`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/config/DatabaseSchemaAutoPatch.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/controller/CategorizationRuleController.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/controller/TransactionController.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/dto/rules/RuleRequest.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/dto/transaction/TransactionsResponse.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/model/CategorizationRule.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/model/PendingClassificationHandoff.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/model/RuleApplication.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/model/Transaction.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/repository/CategorizationRuleRepository.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/repository/PendingClassificationHandoffRepository.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/repository/RuleApplicationRepository.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/repository/TransactionRepository.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/CategorizationRuleService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/InternalTransferReconciliationService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/PendingClassificationBridge.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/PlaidTransactionIngestService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/TransactionClassificationService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/TransactionService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/UserService.java`
- `fintech-api/src/main/resources/db/migration/V24__transaction_categorization_rules.sql`
- `fintech-api/src/test/java/com/fintechapp/fintech_api/integration/service/CategorizationConcurrencyIntegrationTest.java`
- `fintech-api/src/test/java/com/fintechapp/fintech_api/integration/service/CategorizationRulesIntegrationTest.java`

The pre-existing `client/app.json` version changes are preserved and excluded from this implementation.
