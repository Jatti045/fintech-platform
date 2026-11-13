package com.fintechapp.fintech_api.config;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class DatabaseMigrationsIntegrationTest {
    private final String schema = "migration_" + UUID.randomUUID().toString().replace("-", "");
    private final DriverManagerDataSource data = localDataSource();
    private final JdbcTemplate jdbc = new JdbcTemplate(data);
    private final DatabaseMigrations strategy = new DatabaseMigrations();

    private static DriverManagerDataSource localDataSource() {
        String url = System.getenv("TEST_DB_URL");
        if (url == null) url = "jdbc:postgresql://localhost:5432/fintech_api_test";
        if (!url.matches("jdbc:postgresql://(?:localhost|127\\.0\\.0\\.1):[0-9]+/[a-zA-Z0-9_]+")) {
            throw new IllegalArgumentException("Migration tests require a disposable loopback PostgreSQL database");
        }
        return new DriverManagerDataSource(url, System.getenv().getOrDefault("TEST_DB_USERNAME", "postgres"),
                System.getenv().getOrDefault("TEST_DB_PASSWORD", "postgres"));
    }

    private FluentConfiguration configuration() {
        return Flyway.configure().dataSource(data).schemas(schema).defaultSchema(schema)
                .baselineOnMigrate(false).cleanDisabled(true).validateMigrationNaming(true)
                .locations("classpath:db/migration");
    }

    @AfterEach
    void removeDisposableSchema() {
        jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
    }

    @Test
    void cleanInstallOrdersBothV15ChangesAndValidationDoesNotWrite() {
        Flyway flyway = configuration().load();
        assertThrows(RuntimeException.class, () -> strategy.databaseMigrationStrategy(false).migrate(flyway));
        assertNull(jdbc.queryForObject("SELECT to_regnamespace(?)::text", String.class, schema));
        flyway.migrate();
        var applied = Arrays.stream(flyway.info().applied())
                .filter(entry -> entry.getVersion() != null).map(entry -> entry.getVersion().getVersion()).toList();
        assertTrue(applied.indexOf("15") >= 0);
        assertEquals("15.1", applied.get(applied.indexOf("15") + 1));
        assertEquals("32", applied.get(applied.size() - 1));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        strategy.databaseMigrationStrategy(false).migrate(flyway);
        strategy.databaseMigrationStrategy(false).migrate(flyway);
        assertEquals(applied.size(), jdbc.queryForObject("SELECT count(*) FROM " + schema
                + ".flyway_schema_history WHERE version IS NOT NULL", Integer.class));
    }

    @Test
    void legacySqlUpgradePreservesLedgerAndRepairsOnlyKnownCases() {
        configuration().target("14").load().migrate();
        jdbc.update("INSERT INTO " + schema + ".users(id,email,password,username) VALUES ('u','test@example.invalid','test','test')");
        jdbc.update("INSERT INTO " + schema + ".user_monthly_incomes(id,user_id,month_start,income) "
                + "VALUES ('income','u','2026-01-01T00:00:00Z',2000)");
        jdbc.update("INSERT INTO " + schema + ".budgets(id,user_id,date,category,budget_limit,spent,is_auto_created) VALUES "
                + "('manual','u','2026-01-01T00:00:00Z','Food',100,10,FALSE),"
                + "('duplicate','u','2026-01-01T00:00:00Z','food',0,20,TRUE)");
        jdbc.update("INSERT INTO " + schema + ".plaid_items(id,item_id,user_id,access_token_encrypted,cursor) "
                + "VALUES ('item','provider-item','u','fixture-ciphertext','fixture-cursor')");
        jdbc.update("INSERT INTO " + schema + ".transactions(id,user_id,budget_id,transaction_date,name,category,type,amount,plaid_transaction_id) VALUES "
                + "('purchase','u','duplicate','2026-01-03T00:00:00Z','Groceries','Food','EXPENSE',20,'purchase-id'),"
                + "('pay','u','manual','2026-01-03T00:00:00Z','Paycheck','Income','INCOME',1200,NULL),"
                + "('refund','u',NULL,'2026-01-04T00:00:00Z','Merchant refund','Shopping','INCOME',5,'refund-id')");

        configuration().load().migrate();

        assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM " + schema + ".transactions", Integer.class));
        assertEquals("manual", jdbc.queryForObject("SELECT budget_id FROM " + schema
                + ".transactions WHERE id='purchase'", String.class));
        assertEquals(30d, jdbc.queryForObject("SELECT spent FROM " + schema + ".budgets WHERE id='manual'", Double.class));
        assertEquals(100d, jdbc.queryForObject("SELECT budget_limit FROM " + schema + ".budgets WHERE id='manual'", Double.class));
        assertEquals("INCOME", jdbc.queryForObject("SELECT type FROM " + schema + ".transactions WHERE id='pay'", String.class));
        assertNull(jdbc.queryForObject("SELECT budget_id FROM " + schema + ".transactions WHERE id='pay'", String.class));
        assertEquals(1200d, jdbc.queryForObject("SELECT amount FROM " + schema + ".transactions WHERE id='pay'", Double.class));
        assertEquals(-5d, jdbc.queryForObject("SELECT amount FROM " + schema + ".transactions WHERE id='refund'", Double.class));
        assertEquals(2000d, jdbc.queryForObject("SELECT income FROM " + schema + ".user_monthly_incomes WHERE id='income'", Double.class));
        assertEquals("fixture-cursor", jdbc.queryForObject("SELECT cursor FROM " + schema + ".plaid_items WHERE id='item'", String.class));
        assertEquals("fixture-ciphertext", jdbc.queryForObject("SELECT access_token_encrypted FROM " + schema + ".plaid_items WHERE id='item'", String.class));
    }

    @Test
    void populatedGoalDataStopsTheDestructiveTransition() {
        configuration().target("16").load().migrate();
        jdbc.update("INSERT INTO " + schema + ".users(id,email,password,username) VALUES ('u','test@example.invalid','test','test')");
        jdbc.update("INSERT INTO " + schema + ".goals(id,user_id,target,progress) VALUES ('g','u',100,20)");
        var flyway = configuration().load();
        assertThrows(FlywayException.class, flyway::migrate);
        assertEquals("16", flyway.info().current().getVersion().getVersion());
        assertEquals(20d, jdbc.queryForObject("SELECT progress FROM " + schema + ".goals WHERE id='g'", Double.class));
    }

    @Test
    void explicitBaselineRequiresAFollowingVerifiedMigration() {
        configuration().target("31").load().migrate();
        // Model an inspected database whose schema was initialized outside Flyway.
        jdbc.execute("DROP TABLE " + schema + ".flyway_schema_history");
        var flyway = configuration().baselineVersion("31").load();
        flyway.baseline();
        assertThrows(IllegalStateException.class, () -> strategy.databaseMigrationStrategy(false).migrate(flyway));
        assertEquals(1, flyway.migrate().migrationsExecuted);
        strategy.databaseMigrationStrategy(false).migrate(flyway);
    }

    @Test
    void duplicateVersionIsRejectedBeforeWrites(@TempDir Path files) throws Exception {
        Files.writeString(files.resolve("V1__one.sql"), "CREATE TABLE first_table(id INT);");
        Files.writeString(files.resolve("V1__two.sql"), "CREATE TABLE second_table(id INT);");
        var flyway = configuration().locations("filesystem:" + files).load();
        assertThrows(FlywayException.class, flyway::migrate);
        assertNull(jdbc.queryForObject("SELECT to_regclass(?)::text", String.class, schema + ".first_table"));
    }

    @Test
    void failedMigrationRollsBackAndCanBeRetried(@TempDir Path files) throws Exception {
        Files.writeString(files.resolve("V1__setup.sql"), "CREATE TABLE example(id INT PRIMARY KEY);");
        Path next = files.resolve("V2__write.sql");
        Files.writeString(next, "INSERT INTO example VALUES (1); SELECT 1/0;");
        var flyway = configuration().locations("filesystem:" + files).load();
        assertThrows(FlywayException.class, flyway::migrate);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM " + schema + ".example", Integer.class));
        assertEquals("1", flyway.info().current().getVersion().getVersion());
        Files.writeString(next, "INSERT INTO example VALUES (1);");
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM " + schema + ".example", Integer.class));
    }

    @Test
    void nonEmptyUntrackedDatabaseRequiresExplicitBaseline() {
        jdbc.execute("CREATE SCHEMA " + schema);
        jdbc.execute("CREATE TABLE " + schema + ".untracked(id INT)");
        var flyway = configuration().load();
        assertThrows(FlywayException.class, flyway::migrate);
        assertNull(jdbc.queryForObject("SELECT to_regclass(?)::text", String.class, schema + ".flyway_schema_history"));
    }
}
