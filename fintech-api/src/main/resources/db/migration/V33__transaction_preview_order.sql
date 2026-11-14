-- Supports keyset traversal in the rule preview's deterministic order.
CREATE INDEX idx_transactions_user_date_id
    ON transactions(user_id, transaction_date DESC, id ASC);
