-- Deliberately independent of users/items: deletion must not cascade away cleanup work.
-- No user, institution, cursor, or financial data is retained, only the encrypted
-- credential and the operational metadata needed to revoke and retry it.
CREATE TABLE IF NOT EXISTS plaid_revocation_jobs (
    id VARCHAR(36) PRIMARY KEY,
    access_token_encrypted TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    lease_owner VARCHAR(36),
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    last_error_code VARCHAR(128),
    last_error_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_revocation_jobs_claim
    ON plaid_revocation_jobs(next_attempt_at, lease_expires_at);
