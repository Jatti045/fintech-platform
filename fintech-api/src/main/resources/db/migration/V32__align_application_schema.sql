-- Bring the historical SQL installation in line with the application schema.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_lock_token VARCHAR(64);
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_lock_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
