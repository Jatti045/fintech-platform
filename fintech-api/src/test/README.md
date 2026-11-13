# Integration Test Setup

This project includes full-context integration tests under `src/test/java/com/fintechapp/fintech_api/integration`.

## Prerequisites

- Java 17+
- A fresh, disposable local PostgreSQL test database

Default test datasource values are in `src/test/resources/application-test.properties` and can be overridden:

- `TEST_DB_URL`
- `TEST_DB_USERNAME`
- `TEST_DB_PASSWORD`
- `TEST_JWT_SECRET_KEY`

## Run

```bash
./mvnw test
```

To use a custom test DB:

```bash
TEST_DB_URL=jdbc:postgresql://localhost:5432/fintech_api_test \
TEST_DB_USERNAME=postgres \
TEST_DB_PASSWORD=postgres \
./mvnw test
```

## Notes

- Tests use `@SpringBootTest` + `@AutoConfigureMockMvc` and hit real application beans.
- The test profile runs the same Flyway migrations as the release command. Hibernate validates the schema.
- Most tests roll back database changes per method. Tests that verify real commits clean up their fixtures explicitly.
- Some role-based and cloud-upload happy-path tests are marked `TODO`/`@Disabled` until RBAC and external-upload test strategy are finalized.

