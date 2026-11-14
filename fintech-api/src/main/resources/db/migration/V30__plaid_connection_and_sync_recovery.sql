DO $migration$
BEGIN
    PERFORM pg_advisory_xact_lock(1920148834, 30);
    CREATE TABLE IF NOT EXISTS plaid_connection_attempts (
        token_digest VARCHAR(64) PRIMARY KEY,
        attempt_id UUID NOT NULL UNIQUE,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        state VARCHAR(24) NOT NULL DEFAULT 'EXCHANGING'
            CHECK (state IN ('EXCHANGING', 'CONNECTED', 'UNCONFIRMED', 'CLEANUP_QUEUED')),
        local_item_id VARCHAR(36)
    );
    CREATE INDEX IF NOT EXISTS idx_plaid_connection_attempts_user ON plaid_connection_attempts(user_id);
    ALTER TABLE plaid_sync_jobs ADD COLUMN IF NOT EXISTS recover_after TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_plaid_sync_jobs_recover_after ON plaid_sync_jobs(recover_after)
        WHERE status = 'FAILED' AND recover_after IS NOT NULL;
END
$migration$;
