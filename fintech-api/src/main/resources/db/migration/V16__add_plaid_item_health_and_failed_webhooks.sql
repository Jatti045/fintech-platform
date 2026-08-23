-- Plaid hardened user feedback:
--   * item health fields (status, sync_error, last_synced_at, reauth_requested_at)
--   * failed_webhooks dead-letter queue for unprocessable webhook payloads.

ALTER TABLE plaid_items
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE plaid_items
    ADD COLUMN IF NOT EXISTS sync_error BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE plaid_items
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE plaid_items
    ADD COLUMN IF NOT EXISTS reauth_requested_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS failed_webhooks (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(128),
    payload TEXT,
    error_type VARCHAR(255),
    error_message VARCHAR(2000),
    stack_trace TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_webhooks_received_at
    ON failed_webhooks(received_at);