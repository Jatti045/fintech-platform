package com.fintechapp.fintech_api.config;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.stereotype.Component;

/** Adopt Flyway for new migrations without replaying the legacy startup scripts. */
@Component
public class GoogleIdentitySchemaMigration implements SmartInitializingSingleton {
    private final DataSource database;
    private final DatabaseSchemaAutoPatch legacySchema;

    public GoogleIdentitySchemaMigration(DataSource database, DatabaseSchemaAutoPatch legacySchema) {
        this.database = database;
        this.legacySchema = legacySchema;
    }

    @Override
    public void afterSingletonsInstantiated() {
        // Hibernate is initialized; finish schema upgrades before lifecycle/scheduled work starts.
        legacySchema.run(new DefaultApplicationArguments());
        Flyway.configure().dataSource(database)
                .locations("classpath:db/identity-migration")
                .table("identity_schema_history")
                .baselineOnMigrate(true).baselineVersion("28")
                .cleanDisabled(true).load().migrate();
    }
}
