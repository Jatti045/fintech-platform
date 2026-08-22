package com.fintechapp.fintech_api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.lang.NonNull;

@Component
@SuppressWarnings("SqlNoDataSourceInspection")
public class DatabaseSchemaAutoPatch implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseSchemaAutoPatch.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseSchemaAutoPatch(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(@NonNull ApplicationArguments args) {
        // Safety patch for month-scoped user income persistence.
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_monthly_incomes (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    month_start TIMESTAMP WITH TIME ZONE NOT NULL,
                    income DOUBLE PRECISION NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT fk_user_monthly_incomes_user
                        FOREIGN KEY (user_id) REFERENCES users(id),
                    CONSTRAINT uq_user_monthly_incomes_user_month
                        UNIQUE (user_id, month_start)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_monthly_incomes_user_month
                ON user_monthly_incomes(user_id, month_start)
                """);

        // Plaid integration schema.
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS plaid_items (
                    id VARCHAR(36) PRIMARY KEY,
                    item_id VARCHAR(128) NOT NULL,
                    access_token_encrypted TEXT NOT NULL,
                    institution_name VARCHAR(255),
                    cursor TEXT,
                    user_id VARCHAR(36) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_plaid_items_item_id UNIQUE (item_id),
                    CONSTRAINT fk_plaid_item_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id
                ON plaid_items(user_id)
                """);

        // Idempotency key for Plaid-synced transactions (column on existing table).
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_transaction_id VARCHAR(128)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_plaid_id
                ON transactions(plaid_transaction_id)
                WHERE plaid_transaction_id IS NOT NULL
                """);

        // Internal transfers (movement between the user's own accounts) must
        // never count toward income or expense analytics.
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN NOT NULL DEFAULT FALSE
                """);

        // The reconnect/pending deduplication columns were removed — drop the
        // leftovers from databases created before the removal. plaid_item_id
        // was dropped once for the old reconnect scheme but is now re-introduced
        // below as the account/institution ownership key.
        jdbcTemplate.execute("""
                ALTER TABLE transactions DROP COLUMN IF EXISTS plaid_pending_transaction_id
                """);
        jdbcTemplate.execute("""
                DROP INDEX IF EXISTS idx_transactions_plaid_item
                """);

        // Persist the Plaid account and Plaid item (financial institution
        // connection) each transaction was synchronized from. Nullable:
        // historical transactions predate these columns and are not backfilled.
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_account_id VARCHAR(128)
                """);
                jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_item_id VARCHAR(128)
                """);
        // Plaid's personal_finance_category.detailed code (e.g.
        // TRANSFER_*_ACCOUNT_TRANSFER vs TRANSFER_*_THIRD_PARTY_P2P). Nullable:
        // persisted for new transactions only; used to gate transfer pairing.
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_pfc_detailed VARCHAR(128)
                """);

        // Ownership-scoped lookup for proof-based internal-transfer pairing.
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_transactions_user_plaid_item
                ON transactions(user_id, plaid_item_id)
                """);

        // Icons were removed from budgets and transactions — drop the leftover
        // columns from databases created before the removal.
        jdbcTemplate.execute("""
                ALTER TABLE budgets DROP COLUMN IF EXISTS icon
                """);
        jdbcTemplate.execute("""
                ALTER TABLE transactions DROP COLUMN IF EXISTS icon
                """);

        // Income transactions may exist without a budget, so budget_id is now
        // nullable (previously NOT NULL).
        jdbcTemplate.execute("""
                ALTER TABLE transactions ALTER COLUMN budget_id DROP NOT NULL
                """);

        // Auto-created Plaid categories are flagged as unbudgeted until the user
        // assigns a limit.
        jdbcTemplate.execute("""
                ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_auto_created BOOLEAN NOT NULL DEFAULT FALSE
                """);

        logger.info("Database schema patch check completed for user_monthly_incomes, plaid_items, transactions");
    }
}
