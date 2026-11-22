# Fundleaf architecture audit: verified prerequisite checkpoint

Updated November 17, 2026 (America/Toronto). **Prerequisite repairs complete; no architectural migration implemented.** The initial audit baseline is retained below as historical evidence.

## Increment 1 — architecture enforcement baseline

Starting checkpoint: `f66fed1d8529eeade5d7fc27e664ef6207c9da58`, verified on `dev` with no new tracked changes. Increment 1 adds test infrastructure and conventions only. Enforcement commit `b06454261d5e227a8d2dbb055b6adab068035aff` is local and **not pushed**; the documentation successor is identified in the completion report.

| Check | Verified prerequisite | Increment 1 |
|---|---|---|
| Backend Java 17 | 783 passed, 0 failed/errors, 11 skipped | **809 passed, 0 failed/errors, 11 skipped** (820 total) |
| Added architecture tests | None | **26 passed**, no skips: 4 production guards + 22 policy/counterexample checks |
| Compilation and executable packaging | Passed | Passed as part of full `clean verify` |
| Runtime dependency/artifact inspection | Prior baseline | ArchUnit is test-only and absent from the runtime JAR; no test fixture classes packaged |
| Changed Java formatting | Passed | Passed |
| Applicable actual commit hooks | Passed | Passed, including YAML, secret scanning, size/hygiene and Java formatter; frontend/Docker hooks skip because those files were not changed |
| Frontend tests / Expo lint / broader ESLint / TypeScript / exports | 573 passed / 0 warnings / 98 existing warnings and 0 errors / passed / passed | Prior results retained; frontend source and configuration are byte-for-byte unchanged and were not revalidated in this backend-only increment |

All original 783 passing backend tests remain passing, and 26 added tests account for the increase. No original regression test was weakened, disabled or edited. The 11 existing RBAC/upload/healthy-Redis skips are unchanged. Existing compile deprecation/unchecked notes and expected negative-test/Redis-outage logs remain; no new warning was introduced to accommodate the enforcement.

The independent architecture-only Java 17 command also passes: `./mvnw -Dtest=ArchitectureTest,ArchitecturePolicyTest clean test` from `fintech-api`. It requires no database/provider credentials. `.github/workflows/architecture.yml` uses the same clean command on Java 17; no hosted run has occurred because the commits are deliberately unpushed.

The full suite used the existing sanitized test recipe with `TEST_DB_URL=jdbc:postgresql://127.0.0.1:55439/fundleaf_increment1`, a new disposable loopback PostgreSQL database, disabled dotenv import, no inherited live provider credentials, and unavailable loopback Redis. The database was stopped afterward. Logs: `/private/tmp/fundleaf-increment1-final-java17.log` and `/private/tmp/fundleaf-architecture-tests.log`. Counts were checked against XML testcase records; runtime JAR contents were inspected directly.

A first full run exposed differences between stale IDE-compiler synthetic enum/lambda metadata and clean Java 17 javac output in the initial, uncommitted architecture snapshot. Array dependencies were also normalized to their element types. The corrected fixed snapshot was then tested with independent clean builds and the final full suite. This was checker/bootstrap correction, not a runtime regression or automatic baseline refresh. Ordinary test runs have no snapshot-update path.

See [the conventions and rule reference](clean-architecture-conventions.md) for 239 exact legacy classes, 2,327 visible member-level exceptions with reasons/removal stages, counterexample evidence and no-empty-feature guards. There are **zero declared migrated features**. The recurring workflow and all other business operations remain unmigrated. Healthy Redis and native-device behavior are still unverified, with the same environmental limitations recorded below.

## Prerequisite checkpoint results and comparison (historical)


| Check | Initial audit | Verified prerequisite checkpoint |
|---|---|---|
| Backend Java 17 | 781 passed, 2 failed, 11 skipped | **783 passed, 0 failed, 0 errors, 11 skipped** (794 total) |
| Client | 573 passed / 63 suites; open handles | **573 passed / 63 suites**, 0 failed/skipped; ordinary Jest exits naturally with code 0 and no open-handle warning |
| TypeScript | Passed | Passed |
| Expo lint | 0 errors / 3 warnings; zero-warning hook fails | **0 errors / 0 warnings**, including actual zero-warning commit hook |
| Broader `eslint .` | 0 errors / 101 warnings | **0 errors / 98 warnings**; the three effect warnings were removed, remaining warnings are existing test/mock/import/type/style issues |
| Java compilation / packaging | Compilation succeeds; verify fails tests; tests-skipped package succeeds | **Java 17 `clean verify` succeeds**, including tests and executable JAR packaging |
| Web export | Passed | Passed: 1,712 modules |
| iOS export | Passed | Passed: 1,608 modules |
| Android export | Passed | Passed: 2,045 modules |
| Changed-file Java formatting | Unsupported flag, then existing format differences | Passes supported dry-run check on the changed Java files |
| Actual pre-commit | Blocked | **Applicable checks pass on each successful commit**; irrelevant YAML/JSON/TOML/Docker hooks skip when no matching changed file exists |
| Checkpoint | Original staged work only | Feature and prerequisite commits saved and pushed; implementation checkpoint independently verified on `origin/dev` |

Counts were cross-checked against individual backend XML testcase records and client JSON output. No test assertion was removed, disabled or weakened. The 11 backend skips remain the same five explicitly disabled RBAC/upload placeholders and six healthy-Redis cases skipped because Redis was intentionally unavailable. These are explained limitations, not passing integrations.

## Problems, causes and repairs

### Expo effect warnings

`BudgetModal.tsx` omitted `onClose` and React state setters from close/edit effect dependencies. `TxModal.tsx` omitted the setters used to populate an edited transaction. The setters originate in `useState` and are stable; the budget close effect already checks an open-to-closed transition before resetting/calling `onClose`. The fix lists the actual dependencies. Existing modal save/edit/dismissal/uniqueness-error tests continue to pass, without lint suppression or form-flow changes.

### Formatter configuration and formatting

The installed google-java-format is 2.0.0. `--help` has no `--java-17-plus` option. Maven targets Java 17; the installed formatter launcher normally uses a newer JDK, and Docker's build/runtime are Java 21. Removing the unsupported option retains `--dry-run --set-exit-if-changed` and does not remove formatting validation.

The formatter JAR itself requires Java 21 or newer (class version 65); an explicit trial with Java 17 fails before formatting. **Use a supported tool JDK for formatting/pre-commit and Java 17 for the application verification.** On this machine the formatter's Homebrew launcher selects its default newer JDK when JAVA_HOME is unset. For a shell exporting Java 17 globally, invoke formatting/pre-commit with JAVA_HOME set to an installed Java 21+ JDK. The application's Maven target remains 17.

Nineteen originally staged Java files needed formatting once the invalid flag was removed. Those files were formatted in the feature checkpoint; the touched migration test was formatted in the baseline-test commit. Untouched Java source was not reformatted. A comparison confirmed formatter output against the original staged bytes for all 19 before a final formatter pass on PlaidConnectionService and the JWT-fixture repair below. Formatting required a second pass for PlaidConnectionService; the actual commit's dry-run check then passed.

Formatting exposed an existing deterministic JWT test literal to Gitleaks as a newly changed line. `AuthControllerSecurityTest` now injects the configured test signing key through `@Value`, instead of duplicating the same literal in a field. It still signs test tokens with the same configured value. No secret scanner exception or production key change was introduced.

### V34 migration assertions

V34 is the only migration numbered 34 and follows V32 schema alignment and V33 preview ordering. It adds `users.setup_complete`, assigns true to pre-existing accounts, then changes the default to false for subsequent accounts. The staged entity, setup endpoint and routing require that column and distinction. Keeping terminal V33 would contradict the intended feature.

`DatabaseMigrationsIntegrationTest` now expects terminal V34 exactly once, checks the three transitions after a V31 baseline, asserts that a newly inserted account defaults to incomplete setup, and confirms that an existing upgrade fixture is grandfathered. Existing V15/V15.1 order, unique-version rejection, repeated-migration idempotency, validation-only startup, populated-goal guard, rollback and legacy data-preservation tests still run. No historical SQL was edited. Full Flyway validation reports 35 migrations, including V15.1.

Terminal-version and post-baseline-count assertions intentionally pin this release, so future migrations must update them. A future improvement is a shared release-version expectation plus per-migration schema/data postconditions; dynamically accepting whatever maximum filename exists would weaken the release gate. That redesign is deferred.

### Jest resource lifetime

A `--detectOpenHandles` diagnostic captured 55 live timer handles from mounted component/hook test trees, notably MonthPicker's 60-second clock and financial report polling. The production effects already return cleanup functions; tests were not consistently unmounting their trees.

After unmount cleanup, the ordinary command still waited for RTK Query cache retention. Temporary timer instrumentation identified 60-second retention timers and short subscription-update timers in test-owned stores. The instrumentation was diagnostic only and is not part of the application or committed test configuration.

`testUtils/rendererCleanup.ts` registers per-test cleanup: capture mounted renderer roots, unmount them inside `act`, abort/await running test requests, reset the tracked RTK API state to release polling/cache timers, and restore the renderer spy. `configureTestStore.ts` retains configureStore's public typing and registers each test store for cleanup. Sixteen API-store suites switch only their store-factory import; BudgetHeader additionally registers renderer-only cleanup. No application cache TTL, fake timer setting, query behavior, assertion, Jest timeout or process-exit policy was changed.

The final ordinary command `npm test -- --runInBand --watchman=false` passed and exited code 0 naturally. The initial leaking diagnostic process was interrupted only after its stacks were captured; that failed diagnostic is not counted as successful verification. No final validation used `--forceExit`, `process.exit`, blanket timer deletion or forced termination. A broad lint check also caught that the registration helper's original `use...` name looked like a React hook; it was renamed `registerRendererCleanup`, with a final complete suite run.

## File scope and preservation

- Original intended feature changes: the original 48 staged paths are preserved in `0943591`, with mandatory Java formatting, configured test-key reuse and the two narrowly required modal dependency fixes.
- Tooling: `.pre-commit-config.yaml` removes the unsupported option while retaining formatting checks.
- Baseline tests: `DatabaseMigrationsIntegrationTest.java` updates intended release and schema/data assertions; two new `client/testUtils` helpers plus 17 client test files manage resource ownership. The test files and their reasons are enumerated by commits `c638a6d` and `dc0b29b`.
- Documentation: only this baseline and the existing architecture audit receive prerequisite findings/status updates. The architecture migration proposal remains unimplemented.

The first attempted isolated tooling/modal commit failed because pre-commit restored older tracked types while newly added setup files remained in the checkout. All work was restored. To preserve truthful hooks without manipulating/deleting those files, the formatter configuration was committed alone, then the original feature plus its required lint/format repairs, then the baseline-test repairs. This is why the two modal fixes accompany the feature checkpoint rather than the standalone tooling commit.

`sites/fundleaf-budget` is an independent nested Git repository, branch `main`, HEAD `26335fe` (`Update Site source`), with its own `.git`, `.openai/hosting.json`, and generated `dist/` website. It has no configured remote in its local Git configuration and no source package was found in its tracked root. Its nested worktree is clean. Recommendation: keep it separate from the application checkpoint; decide its long-term home later. It was neither staged, deleted, ignored nor edited.

## Commits and remote evidence

| Commit | Purpose |
|---|---|
| `996cef3a3208ef6f2f3e86d334ebbe5dc9a7b085` | Unsupported formatter option repair |
| `094359153e17cde315e2c9237f088f5001e3304a` | Original feature checkpoint with required lint/format/test-key repairs |
| `c638a6d8181bb8afa85328b97e4482540f1cb975` | Migration assertions and Jest resource cleanup |
| `dc0b29b583239ce97f6f777007a0f00ca5388d2e` | Test registration naming correction for broad lint |

`git push origin dev` succeeded without force. A separate `git ls-remote origin refs/heads/dev` returned **dc0b29b583239ce97f6f777007a0f00ca5388d2e**, confirming the implementation checkpoint. The following documentation-only commit contains these two reports; its own hash and the independently verified final remote HEAD are recorded in the completion report, since a commit cannot contain its own hash. No architecture-enforcement or pilot implementation is included.

## Reproduction and remaining limits

Use the original safe recipe below, with `TEST_DB_URL=jdbc:postgresql://127.0.0.1:55439/fundleaf_prerequisite`. This increment used a newly created empty database in the disposable cluster, sanitized provider-free environment, disabled local dotenv loading, Java 17 and unavailable loopback Redis. The database was stopped after verification. No production system or real financial account was accessed.

Final logs: `/private/tmp/fundleaf-prerequisite-java17.log`, `fundleaf-prerequisite-jest.json`, `fundleaf-prerequisite-jest.log`, `fundleaf-prerequisite-types.log`, `fundleaf-prerequisite-lint.log`, `fundleaf-prerequisite-broad-lint.log`. Platform artifacts/log: `/private/tmp/fundleaf-repair-export/` and `/private/tmp/fundleaf-repair-export.log`. Temporary paths are not durable repository artifacts.

Healthy Redis remains unverified: Docker is stopped/unavailable and no Redis server binary was found under the inspected installed tools. Existing outage tests ran; six healthy-cache tests skip by assumption. Native integration remains unverified: `adb` is absent and `xcrun simctl` is unavailable. Bundle export is not device validation of Plaid, Google sign-in or notifications. No new infrastructure was installed and no credentials were requested to pretend otherwise.

The broad lint warnings are existing import ordering/default-name conventions, unused values, test require imports and a wrapper-object type; they are recorded rather than suppressed or expanded into unrelated cleanup. Export logs also contain nonblocking Node color-environment and stale Browserslist database notices. Backend logs include expected negative-test error traces and unavailable-Redis warnings. The ambiguous PATCH/PUT mapping warning remains a separate contract decision from the audit; no route was changed.

Recommended next step: review and separately approve Increment 1 (architectural boundary enforcement and contract characterization). Before migrating the recurring cached feature, arrange a disposable healthy Redis verification run; native integration changes require a later authorized device/sandbox check. **Do not start the recurring pilot or any other architectural migration automatically.**

---

## Historical initial audit baseline (before repairs)


November 17, 2026, America/Toronto. Measured against `dev` HEAD `bd4e8626f99e09a57853473e708b8923606303b3` **plus the original 48 staged files**. No architectural implementation was performed. Results are pre-refactoring evidence, not a claim that the staged feature work is fully green.

## Results

| Check | Result |
|---|---|
| Client Jest | 63 suites, 573 passed, 0 failed, 0 skipped |
| Backend Java 17 clean verify | 794 test cases: 781 passed, 2 failed, 0 errors, 11 skipped; build fails at test phase |
| Backend default Java 25 test run | Same 794/781/2/0/11 result |
| Backend compilation | Fresh Java 17 main/test compilation completed during clean verify |
| Backend packaging with tests skipped | Java 17 `package -DskipTests` succeeds; this does not make verification green |
| TypeScript | `tsc --noEmit` succeeds |
| Documented Expo lint | 0 errors, 3 warnings; normal command exits 0; commit hook's zero-warning variant fails |
| Broad ESLint audit | `eslint .`: 0 errors, 101 warnings, exits 0; includes additional source/test/mock scopes |
| Expo export | Web, iOS and Android export succeeds, using offline mode and a dummy loopback API URL |
| Staged whitespace | `git diff --cached --check` succeeds |
| Commit secret checks | Private key and Gitleaks checks pass |
| Java formatting hook | Fails because installed google-java-format 2.0.0 rejects `--java-17-plus` |
| Actual checkpoint | Not created or pushed; original stage preserved |

Backend counts are verified from the Maven summary and all individual XML `testcase` records: 794 unique classname/name/status entries. Do not sum only each XML root's `tests` attribute: nested-suite reporting attributes omit some cases and yield a different aggregate.

## Existing backend failures

Exact source: `fintech-api/src/test/java/com/fintechapp/fintech_api/config/DatabaseMigrationsIntegrationTest.java`.

1. `cleanInstallOrdersBothV15ChangesAndValidationDoesNotWrite`, line 56: expects last applied version `33`, receives `34`.
2. `explicitBaselineRequiresAFollowingVerifiedMigration`, line 115: expects two migrations after baseline 31, receives three.

The staged first-time account setup adds `src/main/resources/db/migration/V34__first_time_account_setup.sql`. These hard-coded expectations were not updated. The same failures occur on the default installed Java 25 and a fresh Java 17 rebuild. They are existing staged-tree baseline failures, not refactoring regressions. Do not remove V34, suppress tests or change historical migrations to obtain green checks. A focused approved repair should assert the intended V34 progression and account grandfathering/default behavior.

`clean verify` stops on these test failures; a successful full Maven verify is not claimed. A separate tests-skipped package confirms the current code can produce an executable JAR. Docker/native production builds and deployments were not run.

## Skipped backend cases

Five disabled cases: four future RBAC scenarios across Auth/Budget/Transaction/User integration tests and one generic Cloudinary upload happy path. Role-based authorization is not currently implemented; these placeholders are not proof of a missing required product feature.

Six `FinancialCacheIntegrationTest` methods skip by assumption when Redis cannot be reached: summary miss/hit/invalidation, month isolation, user isolation, income-change invalidation, currency invalidation and recurring-payment miss/hit/invalidation. This run deliberately pointed Redis at unused loopback port 6399. Redis-outage fallback and existing cache commit-boundary unit/integration tests run, but healthy Redis behavior is **not verified** here. Dedicated local Redis remains a prerequisite before migrating cached features.

## Client limitations

Jest completed and wrote a successful JSON result, then warned that it could not exit because of open handles. Additional post-run asynchronous RTK mock errors appeared in the log. Treat assertion results as passing, but the ordinary test command is not a clean process-lifecycle gate. The initial attempt also failed before tests because Watchman state was not writable; rerunning with `--watchman=false` avoided that environmental dependency. After recording completed assertion results, the lingering audit Jest process was interrupted (exit 130). No test was weakened or configured to ignore failed assertions.

Expo exports validate JavaScript bundles and web rendering, not native SDK operation on a physical device. Google sign-in, live/sandbox bank linking, push/local notification device behavior and App Store/Play delivery were not exercised. Export used a dummy API URL, disabled dotenv loading and enabled offline mode. No actual financial API was contacted.

The three Expo warnings are effect dependencies in `client/components/budget/BudgetModal.tsx:48,55` and `client/components/transaction/TxModal.tsx:175`. Broader ESLint includes 101 warnings, such as unused imports, import ordering, test require imports and named/default import conventions. Preserve this distinction: fixing the three Expo warnings will not automatically make a broad zero-warning ESLint policy pass.

## Safe test environment

A new temporary PostgreSQL 18 cluster was initialized at `/private/tmp/fundleaf-audit-pg`, bound to `127.0.0.1:55439`, with a new empty database `fundleaf_arch_audit`. The existing database/container and production data were not used. Docker was unavailable, so the installed PostgreSQL binary provided the isolated database. Local trusted access was used only for the disposable loopback cluster. It was stopped after verification; temporary files remain available for inspection.

Backend test subprocesses received only PATH, HOME, TMPDIR, LANG, selected JAVA_HOME and explicit test values; inherited provider credentials were excluded. Spring's optional local `.env` import was disabled. Test profile enabled Flyway migrations on the disposable database, selected test JWT/encryption credentials, delayed worker polling, and supplied dummy mail/cloud settings. Plaid credentials and AI key were explicitly empty; FX endpoint was loopback port 9. Tests that exercise provider requests use mocks/MockRestServiceServer. Redis was loopback-only/unavailable. No production database or real provider operation was requested.

## Commands and reproduction

From `client/`:

```sh
npm test -- --runInBand --watchman=false --json --outputFile=/private/tmp/fundleaf-audit-jest.json
./node_modules/.bin/tsc --noEmit
EXPO_NO_DOTENV=1 ./node_modules/.bin/expo lint
./node_modules/.bin/eslint .
EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:9/api \
  ./node_modules/.bin/expo export --platform all --output-dir /private/tmp/fundleaf-audit-export
```

The last command is the verified export invocation. `npm run build:web` currently names a different command (`expo build:web`); its usability was not assumed or verified. `npm run android/ios` and EAS production build/submission are separate platform/release operations and were not run.

From `fintech-api/`, in a sanitized subprocess environment with a fresh disposable loopback test database:

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
PATH="$JAVA_HOME/bin:$PATH"
TEST_DB_URL=jdbc:postgresql://127.0.0.1:55439/fundleaf_arch_audit
TEST_DB_USERNAME=postgres
TEST_DB_PASSWORD=
GOOGLE_ANDROID_CLIENT_ID=audit-client
# Export these test-only variables in the sanitized subprocess.
./mvnw -o clean verify \
  -Dspring.config.import= \
  -Dapp.plaid.environment=sandbox -Dapp.plaid.client-id= -Dapp.plaid.secret= \
  -Dapp.ai.api-key= -Dapp.currency.rates-base-url=http://127.0.0.1:9 \
  -Dspring.data.redis.host=127.0.0.1 -Dspring.data.redis.port=6399 \
  -Dspring.data.redis.connect-timeout=50ms -Dspring.data.redis.timeout=50ms
./mvnw -o -DskipTests package
```

`-o` used already installed Maven dependencies. These values describe the measured run; do not point them at an existing/shared database. The temporary database must be started again or recreated to reproduce. The test-profile worker delays are appropriate for synchronous tests; do not reuse them as production worker configuration.

## Local evidence artifacts

- `/private/tmp/fundleaf-audit-java17.log`: fresh declared-runtime clean verify.
- `/private/tmp/fundleaf-audit-maven.log`: first backend run on default Java 25.
- `/private/tmp/fundleaf-audit-package.log`: Java 17 packaging.
- `/private/tmp/fundleaf-audit-jest.json` and `.log`: client assertion results and lifecycle warnings.
- `/private/tmp/fundleaf-audit-types.log`, `-expo-lint.log`, `-lint.log`: type/lint results.
- `/private/tmp/fundleaf-audit-export.log` and `/private/tmp/fundleaf-audit-export/`: exported bundles/web files.
- `fintech-api/target/surefire-reports/`: individual test reports (generated, untracked/ignored).

These artifacts are temporary and may be removed by the OS or a later build. Raw backend logs contain synthetic fixtures, expected error stack traces and generated development security passwords; they were not copied into committed documentation. No actual credentials are included in this report.

## Increment 3 healthy-cache baseline

Java 17 clean verify with dedicated Redis 7.2.7 and disposable PostgreSQL passed **820 of 825 tests**, with zero failures or errors and five existing skips. Compared with Increment 2, six previously skipped Redis tests ran and the new recovery test passed. Compilation and executable packaging passed. The separately rerun architecture suite covers the updated completion registry. [Reproduction and cache checks](recurring-read-pilot.md)

## Increment 4 authoritative report verification

Java 17 `clean verify` discovered 831 tests. **826 passed, zero failed or errored, five existing skips.** This adds six passing tests over the accepted Increment 3 baseline of 820. It includes 26 ArchUnit tests, ten report characterization tests, three framework-independent reporting tests, seven financial summary HTTP tests, 15 monthly insight service tests and seven healthy Redis cache integration tests. Compilation and executable packaging passed.

All ten report characterization tests also passed against the original implementation in a separate checkout. PostgreSQL 18.3 ran on loopback with a fresh synthetic database for each backend full run. Redis 7.2.7 ran locally with persistence disabled and `-Dtest.requireRedis=true`. Provider credentials and dotenv loading were disabled. The PostgreSQL statement log recorded six report data queries in the same order and transaction before and after. See [reporting verification](financial-report-read.md) for the query boundaries and concurrency cases.

Client reporting, budget-hook and reporting-clock suites passed 31 tests across four suites. TypeScript passed. Jest ran with Watchman disabled because its state directory was inaccessible to the test process. Changed Java formatting and applicable commit hooks passed. No native-device or production validation was performed.

## Increment 5 monthly-income profile verification

Java 17 `clean verify` discovered 838 tests. **833 passed, zero failed or errored, five existing skips.** This adds three endpoint characterization tests and four framework-independent policy/use-case tests to the Increment 4 baseline. All 26 ArchUnit tests passed. Compilation, executable packaging and the seven healthy Redis cases passed. The backend run used disposable loopback PostgreSQL 18.3 and Redis 7.2.7 with provider settings disabled.

The same three HTTP cases passed against the original route. PostgreSQL logged three owner-scoped data reads in the same read-only repeatable-read transaction before and after. The separate JWT lookup remained outside the snapshot. The client authentication, profile and session suites passed 132 tests across 17 suites, and TypeScript passed. See [income/profile read migration](income-profile-read.md).

## Increment 6 account setup verification

Java 17 `clean verify` discovered 847 tests. **842 passed, zero failed or errored, five existing skips.** This adds five characterization cases and four framework-independent tests over Increment 5. All 26 ArchUnit checks, 13 setup integration cases, 15 currency financial-state cases, and eight healthy Redis cases passed. Compilation and executable packaging passed.

The original endpoint passed the same 21 setup and healthy Redis integration cases. The PostgreSQL lock observer confirmed that the competing request waited for the owner row. Both versions executed 11 setup statements on first completion and three on retry in the same fixture. Client authentication, setup and session suites passed 89 tests across 11 suites. TypeScript, changed-file formatting and applicable Git hooks passed. [Setup evidence](account-setup-completion.md)

## Increment 7 standalone monthly-income verification

Java 17 `clean verify` discovered 856 tests. **851 passed, zero failed or errored, five existing skips.** This adds six integration cases and three framework-independent tests. All 26 ArchUnit checks, 17 currency financial-state cases, nine healthy Redis cases, and account-setup, profile read and financial report regressions passed. Compilation and executable packaging passed.

The endpoint, Redis and currency contention cases also passed against the original implementation. PostgreSQL logged six endpoint statements for each insert and update on both versions, including two owner-lock reads. Client profile, budget-hook and session suites passed 69 tests across eight suites. TypeScript, changed-file formatting and applicable Git hooks passed. [Income update evidence](monthly-income-update.md)
