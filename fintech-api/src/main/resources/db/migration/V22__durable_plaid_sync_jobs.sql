CREATE TABLE IF NOT EXISTS plaid_sync_jobs (
    item_id VARCHAR(128) PRIMARY KEY,
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    requested_version BIGINT NOT NULL DEFAULT 1,
    claimed_version BIGINT NOT NULL DEFAULT 0,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    lease_owner VARCHAR(64),
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_error_code VARCHAR(128),
    last_error_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_plaid_sync_jobs_item FOREIGN KEY (item_id)
        REFERENCES plaid_items(item_id) ON DELETE CASCADE,
    CONSTRAINT ck_plaid_sync_jobs_status CHECK
        (status IN ('QUEUED','PROCESSING','RETRYING','SUCCEEDED','ACTION_REQUIRED','FAILED')),
    CONSTRAINT ck_plaid_sync_jobs_versions CHECK
        (requested_version >= claimed_version AND attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_plaid_sync_jobs_claim
    ON plaid_sync_jobs(status, next_attempt_at, lease_expires_at, updated_at);

CREATE INDEX IF NOT EXISTS idx_plaid_items_last_synced
    ON plaid_items(status, last_synced_at);
