# Fundleaf

**Your money, your control.**

Open-source personal finance and budgeting application built with React Native / Expo, Spring Boot, and PostgreSQL.

## Features

- Monthly category budgets, transaction management, and financial summaries.
- Plaid bank connections and transaction synchronization.
- Recurring payment detection and local notification reminders.
- Profile settings, themes, password recovery, and Google sign-in.
- Optional AI monthly explanations with explicit user consent and provider privacy disclosure.

## Project structure

- `client/`: React Native / Expo application and Jest tests.
- `fintech-api/`: Java / Spring Boot API, Maven wrapper, database migrations, and tests.
- `fintech-api/docker-compose.yml`: local PostgreSQL and Redis services.
- `docs/`: financial reporting, categorization, and privacy documentation.

## Local setup

Use Node.js and npm compatible with Expo SDK 54, JDK 17 or 21, and Docker Compose (or your own PostgreSQL and Redis services). The backend Docker build uses Java 21.

From the repository root, start local services:

```sh
docker compose -f fintech-api/docker-compose.yml up -d
```

The Compose file supplies local development database defaults matching `application.properties`. Configure the backend through environment variables or an untracked `fintech-api/.env` properties file. See `fintech-api/src/main/resources/application.properties` for supported variables and defaults. Set `JWT_SECRET_KEY` before starting authentication. Configure `PLAID_CLIENT_ID`, `PLAID_SECRET`, and a stable `PLAID_ACCESS_TOKEN_SECRET` for bank connections; use Plaid sandbox credentials for development. Mail delivery requires the `MAIL_HOST`, `EMAIL_USER`, and `EMAIL_PASSWORD` settings. Cloudinary and AI settings are optional integrations described in that configuration file.

Use a fresh local database for initial development. The current configuration uses `spring.jpa.hibernate.ddl-auto=create-only`; existing database upgrades require the project's migration process, not recreating tables. Never point local setup at production financial data.

Start the API:

```sh
cd fintech-api
./mvnw spring-boot:run
```

In another terminal, from the repository root:

```sh
cd client
npm ci
```

Create an untracked `client/.env` file with:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

For a physical device, use your development computer's reachable LAN address; Android emulators typically use `10.0.2.2` instead of `localhost`. Google sign-in additionally uses `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` with an OAuth client configured for the existing application identifiers.

```sh
npx expo start
```

Plaid and Google sign-in require a native development build with their native modules configured; use `npm run android` or `npm run ios` with the corresponding platform toolchain. Do not expect those integrations to work in Expo Go.

## Verification

From `client/`:

```sh
npm test -- --runInBand
npx tsc --noEmit
npm run lint
npx expo config --type public
npx expo export --platform web
```

From `fintech-api/`:

```sh
./mvnw verify
```

Some backend integration tests require Docker; check skipped tests when Docker is unavailable. Native store builds use the existing EAS configuration and require access to the existing project and signing credentials.

## Branding and compatibility

See [the rebrand notes](docs/fundleaf-rebrand.md) for retained identifiers and artwork awaiting replacement. Existing deployment endpoints and EAS settings are retained. This rebrand does not rename infrastructure or the repository.

## Contributing and licensing

Keep changes focused and include relevant verification results in pull requests. Do not commit credentials or financial data. No license file is currently included; this rebrand adds no license or grant of rights. A maintainer must explicitly approve a license before open-source distribution terms are established.
