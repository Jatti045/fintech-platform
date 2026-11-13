package com.fintechapp.fintech_api.config;

import java.util.Arrays;

import org.flywaydb.core.api.MigrationState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class DatabaseMigrations {
    @Bean
    FlywayMigrationStrategy databaseMigrationStrategy(
            @Value("${app.database.migrate-on-startup:false}") boolean migrate) {
        return flyway -> {
            if (migrate) {
                flyway.migrate();
            }
            var history = flyway.info();
            if (history.pending().length != 0) {
                throw new IllegalStateException("Database migrations are pending. Run the reviewed release migration first.");
            }
            if (Arrays.stream(history.applied()).anyMatch(entry ->
                    entry.getState() == MigrationState.FUTURE_SUCCESS
                            || entry.getState() == MigrationState.FUTURE_FAILED)) {
                throw new IllegalStateException("Database contains migrations newer than this application.");
            }
            flyway.validate();
            var current = history.current();
            if (current == null || current.getState() == MigrationState.BASELINE) {
                throw new IllegalStateException("Database requires a completed versioned migration before startup.");
            }
        };
    }
}
