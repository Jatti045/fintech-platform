# Fundleaf branding

Display name: **Fundleaf**. Lowercase identifier: `fundleaf`.

Description: Open-source personal finance and budgeting application.

Tagline: **Your money, your control.**

## Compatibility identifiers retained

- `com.budgee.finance`: Android package and iOS bundle identifier, preserving store updates and OAuth configuration.
- `budgee-app`: Expo slug in static configuration and dynamic fallback, retained alongside the EAS project ID until an explicit project migration is planned.
- `budgee-encryption-salt` and `budgee-plaid-access-token`: key derivation constants in `EncryptionService`; changing them would prevent decryption of existing Plaid tokens.
- `@jamesattia__budgee-app.jks`: signing-key exclusion in `.gitignore`, protecting existing credentials.
- `V15__detach_income_from_budgets.sql`: historical brand comment left untouched to preserve applied migration checksums.
- `fintech-api`, `com.fintechapp`, database/container/volume names, deployment hosts, OAuth settings, signing credentials, schemes (`client`, `plaidlink`), session/storage keys, JWT claims, notification IDs, and API routes: operational identities remain unchanged.

## Phase 1: authentication, themes, and native artwork

Login and registration use the supplied leaf mark, shared rounded inputs and solid brand buttons, and a scrollable safe-area layout with keyboard avoidance. Existing validation, account fields, recovery, Redux authentication, session storage, and API contracts are retained. Password visibility controls and keyboard next/submit actions are available. Google sign-in retains its existing provider configuration, with loading/disabled feedback and recoverable error handling.

Light and Dark palettes now use the Fundleaf emerald/forest tokens in `client/constants/ThemePalettes.ts`. Semantic foreground pairs cover primary and destructive actions. New users follow device appearance; saved Light, Dark, Ember, and Aurora preferences continue to work through the existing `selectedTheme` storage key. Unknown legacy names fall back to Light. Choosing a theme through the existing Profile controls persists an explicit choice. Home, Transactions, Budgets, and Profile layouts were not redesigned; they inherit the centralized palette changes.

The supplied `client/assets/fundleaf-brand-assets/` package is integrated directly:

- `logo-mark.png`: authentication header.
- `app-icon.png`: default Expo, Android legacy icon, and web favicon.
- `app-icon-light.png` / `app-icon-dark.png`: iOS appearance variants.
- `adaptive-icon-foreground.png`, `adaptive-icon-background.png`, and `adaptive-icon-monochrome.png`: Android adaptive/themed icon layers.
- `splash-mark.png`: centered native splash mark and session-restore loading mark. Splash backgrounds are `#F7FAF8` and `#071D17`.
- The supplied monochrome mark is also used for Android notification artwork.

Full-screen splash posters are reference artwork only; they are not stretched into native splash images. No assets were generated or modified. The old `client/assets/images/icon.png`, `splash-icon.png`, and unused legacy B-shaped component remain unreferenced for now.

### Native release verification

Build a new iOS/Android binary through the existing native/EAS build process. An OTA JavaScript update or Expo Go cannot update launcher icons or the native splash. Check an installed release build in both system appearances, including iOS icon variants, Android adaptive masks and themed icons, and cold-start splash rendering. Launcher icon caching may require reinstalling a test build or refreshing the launcher; avoid uninstalling the user's main app solely for a cosmetic check.

Device checks should also cover keyboard avoidance, small screens, large accessibility font settings, screen-reader controls, Google sign-in, and the email recovery flow. Browser checks and mocked auth tests do not replace a real device/provider sign-in check. No live accounts were created for verification.

Publish through existing store identities and review external store listings, OAuth consent screens, and provider-managed branding separately. No external configuration was changed. Previously cached AI explanations or scheduled notifications may retain historical wording until refreshed by existing flows. No persisted user data, caches, or licenses were rewritten for cosmetic changes.
