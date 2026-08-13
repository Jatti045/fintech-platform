-- Plaid integration: persisted items + idempotency key on transactions.

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
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS plaid_transaction_id VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_plaid_id
    ON transactions(plaid_transaction_id)
    WHERE plaid_transaction_id IS NOT NULL;