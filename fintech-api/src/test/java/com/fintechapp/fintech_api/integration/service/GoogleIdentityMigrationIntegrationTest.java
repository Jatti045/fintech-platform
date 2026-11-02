package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import java.util.UUID;
import javax.sql.DataSource;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class GoogleIdentityMigrationIntegrationTest extends BaseIntegrationTest {
    @Autowired private DataSource database;
    @Autowired private JdbcTemplate jdbc;

    @Test void flywayUpgradesLegacyAccountsOnceWithoutInventingBindingsOrLosingData() {
        String schema = "identity_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("CREATE SCHEMA " + schema);
        try {
            jdbc.execute("CREATE TABLE " + schema + ".users (id VARCHAR(36) PRIMARY KEY, email TEXT, "
                    + "auth_provider TEXT, password TEXT, session_version BIGINT NOT NULL, "
                    + "update_version BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
            jdbc.execute("INSERT INTO " + schema + ".users(id,email,auth_provider,password,session_version,update_version) "
                    + "VALUES ('legacy','legacy@example.com','GOOGLE',NULL,3,7), ('password','password@example.com','EMAIL','hash',2,8)");
            var flyway = Flyway.configure().dataSource(database).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/identity-migration").table("identity_schema_history")
                    .baselineOnMigrate(true).baselineVersion("28").cleanDisabled(true).load();
            assertEquals(1, flyway.migrate().migrationsExecuted);
            assertEquals(4L, jdbc.queryForObject("SELECT session_version FROM " + schema + ".users WHERE id='legacy'", Long.class));
            assertEquals(3L, jdbc.queryForObject("SELECT session_version FROM " + schema + ".users WHERE id='password'", Long.class));
            assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM " + schema + ".users WHERE google_subject IS NULL", Integer.class));
            assertEquals("hash", jdbc.queryForObject("SELECT password FROM " + schema + ".users WHERE id='password'", String.class));
            jdbc.execute("UPDATE " + schema + ".users SET google_subject='verified-subject' WHERE id='legacy'");
            assertEquals(0, flyway.migrate().migrationsExecuted);
            assertEquals("verified-subject", jdbc.queryForObject("SELECT google_subject FROM " + schema + ".users WHERE id='legacy'", String.class));
            assertEquals(4L, jdbc.queryForObject("SELECT session_version FROM " + schema + ".users WHERE id='legacy'", Long.class));
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> jdbc.execute(
                    "UPDATE " + schema + ".users SET google_subject='verified-subject' WHERE id='password'"));
        } finally { jdbc.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }
}
