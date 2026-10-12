# Financial cache encryption and AI privacy

## Findings and threat model

AsyncStorage's application sandbox already restricts ordinary apps. The confirmed gap was unencrypted financial/profile JSON, not evidence of a breach. Application encryption protects exported/copied cache files and restored ciphertext without the device key. It does not protect a compromised running app, a rooted/jailbroken device able to invoke SecureStore, screenshots, or details in user-enabled OS notifications.

Monthly AI summaries exclude raw transactions and account identifiers, but include category labels and recurring bill names. There was no account consent boundary. Previously requested insights could also automatically regenerate after financial cache invalidation.

## Encryption and key management

An encrypted database such as SQLCipher would add native database setup and data conversion for a small, disposable snapshot cache with no local relational queries. Direct SecureStore JSON would put large snapshots in a store intended for small secrets. Standard authenticated encryption of the existing cache preserves its loading behavior with two small direct dependencies already present transitively in this Expo installation.

Noble AES-256-GCM encrypts JSON with a fresh 96-bit nonce for every write. Associated data binds the storage version, user ID, and entry name. Expo Crypto's asynchronous native random-byte API generates the 256-bit key. Only its 64-character hex representation is held in SecureStore, with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; large records remain ciphertext in AsyncStorage. Keys and temporary plaintext byte arrays are cleared after use. JavaScript strings and Redux plaintext cannot be guaranteed erased.

The key is reread from SecureStore for each operation. Entries use `financial-cache:v1:<userId>:<entry>`; owner/entry metadata, nonce and ciphertext length remain visible. Moving ciphertext between users/entries fails authentication. Account switching clears ciphertext/key and user-owned Redux state before establishing the next identity. Session generations and serialized persistence prevent late writes/responses from restoring the old session's cache.

Corrupt ciphertext, missing/invalid keys and failed reads are cache misses, with no plaintext fallback. A missing profile refetches `/auth/me` using the retained token. Financial queries refetch authoritative server records. Offline devices with lost keys cannot use old snapshots, but no server data is deleted.

### Storage inventory and migration

| Storage/key | Data and handling |
|---|---|
| SecureStore `authToken` | Existing token storage; legacy AsyncStorage token migrates before removal. |
| SecureStore `sessionUserIdV1` | Small owner identity established from login or `/auth/me`. |
| SecureStore `financialCacheKeyV1` | Random key, destroyed during logout/invalidation/account switch. |
| AsyncStorage `financial-cache:v1:*` | Encrypted first-page transaction envelopes, monthly budgets, user profiles (including income), dismissed recurring-payment labels. |
| Legacy `userData`, `rtkq:*`, `transactions:*`, `budgets:*`, `dismissedRecurringSeries` | Deleted, then refetched; plaintext snapshots are never copied into new storage. |
| `selectedTheme` | Nonfinancial device preference, retained on logout. |
| `notificationPreferences`, `notificationOnboardingPending` | Nonfinancial reminder/onboarding flags; existing session cleanup removes them. |
| Expo scheduled notifications | OS-managed bill reminder text can include merchant/estimated amount when enabled; outside this cache encryption boundary. |

Migration runs before cache operations, is idempotent, and retries failed/interrupted removals. Existing valid tokens remain available. A stale plaintext token is removed when a secure token already exists. Logout, 401 invalidation, account deletion, password change, and a successful reset of the currently cached user's password share session cleanup. Persistence failures remain best effort, without logging cache contents or keys.

Web builds do not persist financial snapshots or put an encryption key in browser local storage. This does not change existing browser authentication support.

## Backup and native configuration

`app.config.ts` adds the Expo SecureStore plugin with Android backup exclusions, preserving the existing `app.json` edits. Rebuild iOS/Android through Expo/EAS to apply the plugin and include Expo Crypto. Android-restored ciphertext without Keystore material is a cache miss. iOS device-only accessibility restricts key migration, but Keychain entries can survive app reinstallation; uninstall is not guaranteed key deletion.

References: [Expo SecureStore SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/), [Expo Crypto SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/crypto/), [Noble Ciphers 1.3.0](https://github.com/paulmillr/noble-ciphers/tree/1.3.0).

## Server consent and concurrency

V23 adds `ai_processing_enabled` (default false), `ai_consent_version`, and `ai_consent_updated_at` to users. Existing and new accounts stay disabled until explicit acceptance of disclosure version `1`. Startup schema auto-patching mirrors the migration. `/api/users/me/ai-preference` GET/PATCH resolves only the authenticated principal's account; a body cannot choose another user. Enabling requires the current disclosure version; disabling does not.

Monthly generation checks enabled state and disclosure version before financial context generation or any provider call. Generation and consent writes obtain the same PostgreSQL user row lock. Opt-out waits for already admitted generation to finish; after disable succeeds, new calls are rejected. Data already sent cannot be recalled. The lock is held during the existing bounded provider call (default timeout 30 seconds), so concurrent consent/profile writes may wait for completion.

The home card and Profile AI privacy control share server preference state. Cancel/dismiss never grants consent. Acceptance only saves the preference; a separate explicit press generates an explanation. Generation is an RTK mutation: screen loads, preference changes and financial tag invalidation cannot automatically generate requests. AI output stays in memory and is not persisted in the cache or database.

## External payload and disclosure

The provider receives month/year/currency, aggregate income/expenses/net, category totals/prior comparisons, budget labels/limits/spending, and recurring bill labels/amount changes. Raw transactions, stored account/Plaid/user IDs, email, tokens and passwords are excluded as fields. User-written labels may themselves contain personal text; labels are disclosed and treated as untrusted prompt data.

Provider logging uses coarse error types. Google-auth response logs and raw client HTTP error logging were removed. Arbitrary provider configuration means the application cannot assert a universal retention/training policy. The disclosure promises neither zero retention nor exclusion from training.

Set `AI_PUBLIC_PROVIDER_NAME` and `AI_PUBLIC_PRIVACY_POLICY_URL` (HTTPS) to identify the actual service and link its verified current policy. These public settings do not expose API keys or change the endpoint. Operators must review their actual provider/account agreement, especially when changing providers.

## Rollout and verification scope

Apply V23/startup schema patch and deploy backend enforcement before the updated clients; older clients will also be blocked without consent. Rebuild native clients for the backup rules. No production deployment or production data changes are performed by this task.

Tests use real AES-GCM with native storage/randomness mocked and PostgreSQL with a mocked AI provider. They cover tampering, missing keys, module restart, interrupted migration, account switching, cleanup, profile refetch, account-scoped consent and concurrent opt-out. Physical-device, real backup/restore and live-provider behavior require separate validation.

Final verification: Java 17 `mvn clean verify` passed (621 tests discovered, 610 passed, 11 skipped); 47 client suites / 392 tests passed; TypeScript passed; lint passed with four existing BudgetModal/TxModal hook warnings. Expo exported iOS and Android Hermes bundles plus web successfully. Config introspection confirmed SecureStore's Android backup and data-extraction rule references. A first client run hit an existing timing-sensitive notification-onboarding test; two subsequent full runs passed. Jest still needs the existing `--forceExit` workaround for open handles. The migration SQL was exercised twice against a temporary PostgreSQL table containing an existing account and retained disabled/null defaults.

## Complete task file manifest

`client/app.json` contains pre-existing user changes and is excluded from this task.

- `client/__mocks__/expo-crypto.ts`
- `client/__mocks__/expo-secure-store.ts`
- `client/__tests__/apiSlice.test.ts`
- `client/__tests__/encryptedStorage.test.ts`
- `client/__tests__/home/MonthlyInsightCard.test.tsx`
- `client/__tests__/loadingStrategy.test.ts`
- `client/__tests__/profile/AiPrivacyPreference.test.tsx`
- `client/__tests__/sessionExpiry.test.ts`
- `client/api/aiPrivacy.ts`
- `client/api/base.ts`
- `client/api/user.ts`
- `client/app.config.ts`
- `client/app/(tabs)/profile.tsx`
- `client/app/_layout.tsx`
- `client/components/home/MonthlyInsightCard.tsx`
- `client/components/privacy/AiPrivacyDisclosure.tsx`
- `client/components/privacy/AiPrivacyPreference.tsx`
- `client/config/apiClient.ts`
- `client/jest.config.js`
- `client/package-lock.json`
- `client/package.json`
- `client/store/api/apiSlice.ts`
- `client/store/api/cachePersistence.ts`
- `client/store/slices/userSlice.ts`
- `client/utils/encryptedStorage.ts`
- `client/utils/recurring/dismissedSeries.ts`
- `client/utils/secureStorage.ts`
- `client/utils/session.ts`
- `docs/security/financial-cache-ai-privacy.md`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/config/DatabaseSchemaAutoPatch.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/controller/AiPrivacyController.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/dto/user/AiPrivacyResponse.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/dto/user/UpdateAiPrivacyRequest.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/model/User.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/AiPrivacyService.java`
- `fintech-api/src/main/java/com/fintechapp/fintech_api/service/MonthlyInsightService.java`
- `fintech-api/src/main/resources/application.properties`
- `fintech-api/src/main/resources/db/migration/V23__ai_processing_consent.sql`
- `fintech-api/src/test/java/com/fintechapp/fintech_api/ai/AiLoggingSafetyTest.java`
- `fintech-api/src/test/java/com/fintechapp/fintech_api/integration/controller/AiPrivacyIntegrationTest.java`
- `fintech-api/src/test/java/com/fintechapp/fintech_api/service/MonthlyInsightServiceTest.java`
