# Database migrations

Flyway 11.14.1, managed by Spring Boot, owns the schema history in `flyway_schema_history`. The Maven release task and the application use the same scripts in `fintech-api/src/main/resources/db/migration`. PostgreSQL transactional advisory locking serializes migrations. A failing transactional script rolls back its own changes. Earlier successful versions remain recorded. Inspect the failure and the ledger before retrying.

Ordinary API startup checks for pending migrations, validates recorded migrations and checksums, and asks Hibernate to validate mapped schema types before the API serves traffic. It does not apply migrations. The test profile opts into migration at startup to initialize disposable databases. Keep `app.database.migrate-on-startup` disabled in deployments. Use a runtime database role without DDL grants and a separate migration role. The runtime role needs read access to the history table.

## New local database

From `fintech-api`, set `FLYWAY_URL`, `FLYWAY_USER`, and `FLYWAY_PASSWORD` for an empty disposable database, then run:

```sh
./mvnw flyway:info
./mvnw flyway:migrate
./mvnw flyway:validate
```

Start the API with its database connection pointed at that same schema. For non-default schemas configure the same Flyway schema and JDBC current schema on both connections. PostgreSQL 13 or newer is required by the historical refund migration's use of `gen_random_uuid()`. Automatic baselining and Flyway clean are disabled.

## Historical versions

The active V15 is the Plaid metadata migration. Income detachment uses V15.1 with identical SQL bytes. The original income V15 filename and contents remain in `db/historical`, outside Flyway discovery. Other previously published SQL files retain their contents. An additional pre-V17 guard refuses to drop populated legacy goal records or associations. Archive and reconcile them before approving that transition. V18/V19 retain the original deterministic budget merge and reassignment. V21 retains the explicit refund repair. V32 aligns the SQL-installed schema with the application, including nullable provider-only passwords, Plaid lease fields, and lookup indexes. The retired startup orphan-job purge is intentionally excluded from the release path. Investigate and preserve any orphaned jobs on the clone before restoring the V22 foreign key.

## Existing databases

1. Inventory each environment separately. Record the actual history table, versions, script names, checksums, and any failed or missing entries. Take a verified restorable backup and rehearse on an isolated clone. Compare the clone against a clean reference install, including constraints, defaults, indexes, worker tables, and Hibernate validation.
2. For an existing Flyway ledger, preserve it and reconcile discrepancies on the clone. A database that recorded income detachment as V15 has a different checksum from the canonical metadata V15. A database already past V15 or V16 may also have skipped the newly ordered scripts. Stop on any mismatch. Determine which effects are actually present and design a reviewed forward bridge for that specific history. Do not run automatic repair, rewrite checksums, or enable out-of-order execution to bypass the review.
3. For an untracked database created by Hibernate or the old startup runner, an explicit baseline is permissible only after proving the schema and data postconditions through the selected baseline version. For example, V31 is a candidate only if the clone already satisfies all effects through V31, including historical repairs and worker tables. If a prerequisite is missing, prepare and rehearse targeted, forward-only changes for that database before establishing the ledger. Run `flyway:baseline` with an explicitly approved `FLYWAY_BASELINE_VERSION`, then inspect `flyway:info`. Do not reuse this example version as a default.
4. Compare transaction identities and amounts, signed spending and budget links, income baselines and classifications, and Plaid items, cursors and pending jobs before and after the clone rehearsal. Investigate duplicate budgets with competing user-set limits before approving a merge. Also check legacy icon or goal data before approving any historical feature removal. Keep the original data in the verified backup.
5. In a separately authorized maintenance window, quiesce old writers and schedulers, run the reviewed release migration once, verify the ledger and data postconditions, and then start the validating API. If migration fails, hold application startup and follow the rehearsed recovery plan.

The repository provides synthetic fixtures for the historical SQL path. It contains no production snapshot or authoritative inventory of deployed migration histories.
