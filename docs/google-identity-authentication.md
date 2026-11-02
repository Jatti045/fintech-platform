# Google identity authentication

Google sign-in identifies returning users by the unique, case-sensitive `users.google_subject` (`sub`) binding. Google token verification checks the signature, issuer, configured audience, timestamps, subject and verified email. Configure `GOOGLE_ANDROID_CLIENT_ID` for the existing client audience; an absent value disables Google sign-in without disabling password authentication.

## Sign-in and mailbox verification

`POST /api/auth/google` accepts:

```json
{"idToken":"GOOGLE_ID_TOKEN"}
```

A bound subject signs into its existing account. A changed Google email does not change the account's contact email or merge it with another account. A new subject can register directly only when Google is authoritative for its verified email: Gmail, or an email whose domain matches the signed Workspace `hd` claim.

Every existing account without a subject binding, including legacy Google accounts and password accounts, requires fresh mailbox proof before linking. New third-party-email Google accounts require this proof too. The response is HTTP 401 with `Google email verification required. Request a code and try again.` No session is issued at this stage.

The mobile client must present a code-entry flow:

1. Call `POST /api/auth/google/verification-code` with the same `idToken`. This endpoint returns a generic successful response whether or not a code can be issued.
2. Read the six-digit code sent to the token's verified email address.
3. Retry `POST /api/auth/google` with the current token and code:

```json
{"idToken":"GOOGLE_ID_TOKEN","verificationCode":"123456"}
```

The subject and email must match the challenge, and the target local account must still be the account present when the code was requested. A challenge cannot replace an established subject, merge accounts, or attach to a password account registered after challenge issuance. Linking with a different local contact email is intentionally unsupported.

Codes expire after ten minutes, are stored as BCrypt hashes, and permit five failed guesses. Resends have a 60-second cooldown, five requests per email/hour and twenty per source/hour. Code submissions have shared PostgreSQL limits of twenty per email and one hundred per source per fifteen minutes, independently of password recovery. Forwarding headers are trusted only through the existing configured trusted-proxy policy. Codes are deleted after successful binding; account deletion cascades its pending challenge.

Linking retains the original user ID, financial records, contact email, username, password and authentication-provider setting. Password accounts retain password login and password recovery. Binding revokes previously issued sessions and returns a fresh session. Ordinary profile saves cannot overwrite a Google binding.

## Database migration and rollout

The existing schema uses Hibernate bootstrap plus `DatabaseSchemaAutoPatch`, rather than a Flyway history. New identity schema changes are managed by Flyway using `classpath:db/identity-migration`, with the dedicated `identity_schema_history` table and baseline version 28. The initialization hook applies the existing schema patch and then Flyway after Hibernate initializes, before HTTP traffic and scheduled workers start. It does not scan or replay the historical `db/migration` scripts, which include duplicate version numbers.

`V29__bind_google_subjects.sql` adds the nullable subject and unique index, creates mailbox challenges, and increments existing users' session/update versions exactly once. It never infers or backfills subjects from email. All existing users must sign in again after rollout because old JWTs do not identify whether the unsafe email-only Google path issued them. Passwords and financial data are preserved. Flyway checksum validation remains enabled; the migration is not rerun on every startup.

Deploy the mobile code-entry flow together with this backend change so legacy Google users can complete verification in the app. Ensure mail delivery works before rollout. This backend change supplies the endpoints; it does not modify mobile screens.

## Verification

`GoogleIdentityVerifierTest` uses real RSA-signed JWTs and the Google verifier with a fixed test public key. It checks signatures, standard claims, verified email and email authority without contacting Google.

`GoogleIdentityIntegrationTest` exercises the real PostgreSQL identity, challenge, rate-limit and session paths, with Google verification and outbound email replaced by test doubles. It covers registration, returning subjects, changed/colliding emails, unauthorized linking, legitimate linking, legacy binding, challenge scope/expiry/attempts, concurrent registrations, uniqueness, protected entity updates and password recovery.

`GoogleIdentityMigrationIntegrationTest` runs Flyway against a separate legacy test schema and verifies data preservation, one-time session revocation, absence of guessed bindings, and subject uniqueness.

Google identity policy follows [Google's backend authentication guidance](https://developers.google.com/identity/sign-in/android/backend-auth).
