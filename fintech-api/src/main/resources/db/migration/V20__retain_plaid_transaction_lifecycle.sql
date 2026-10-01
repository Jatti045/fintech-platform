-- Also applied by DatabaseSchemaAutoPatch; no historical reclassification at startup.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plaid_pending BOOLEAN;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plaid_pending_transaction_id VARCHAR(128);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plaid_posted_date DATE;
