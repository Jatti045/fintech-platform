# Authentication and data-loading recovery

The reported symptom was an already-open Home/Transactions screen whose data stopped loading, followed by sign-in after restarting. Diagnostics against unchanged code reproduced these defects, without claiming device-level confirmation of a particular incident:

- SecureStore read errors became missing tokens. Protected requests proceeded anonymously, and their 401 responses could not invalidate the active UI because they carried no session identity.
- Token reads waited behind serialized cache writes. Axios's timeout did not cover that request-preparation wait.
- Session restoration reducers accepted late completions after invalidation or account changes.
- Missing/corrupt profile snapshots caused `/auth/me` to run, but any failure became “no stored auth,” including network errors and server outages.

An established session now keeps its identity in process memory. Keychain and profile-cache reads have bounded waits; cache persistence cannot block authenticated API requests. Current-session 401 responses invalidate in-memory authentication and routing immediately, while storage cleanup remains ordered with login persistence. Generation and restoration request-ID checks reject stale completions. Transient restoration failures preserve credentials and expose Retry rather than presenting sign-in. Native foreground events refetch subscribed queries and retry failed restoration. Transactions expose a retry control while retaining existing rows after failed refreshes.

Server JWT signature validation and the seven-day lifetime remain unchanged. There is no refresh-token endpoint or client refresh flow in this application; this change does not issue replacement credentials or extend expired tokens. It retains the existing encrypted, owner-scoped caches and guards against cross-session responses and writes.

Regression tests cover cold restart persistence, keychain failures and stalled reads, overall restoration deadlines, missing profiles, network/timeouts/403/5xx responses, current-session 401 handling, late restore success/failure, blocked cache persistence, foreground recovery, retry routing, and retained transaction rows. Backend security tests cover expired and invalid credentials, legacy seven-day expiry, and a valid token followed by a transient profile-service failure.
