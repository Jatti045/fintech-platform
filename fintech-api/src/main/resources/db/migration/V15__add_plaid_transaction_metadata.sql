ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS plaid_account_id VARCHAR(128);

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS plaid_item_id VARCHAR(128);

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS plaid_pfc_detailed VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_transactions_user_plaid_item
    ON transactions(user_id, plaid_item_id);
