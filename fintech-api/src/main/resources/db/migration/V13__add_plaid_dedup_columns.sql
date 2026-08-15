-- Plaid transaction deduplication hardening.
--
-- 1) plaid_item_id records which Plaid Item synced each transaction. It powers
--    the reconnect deduplication fallback: Plaid scopes transaction_id to a
--    single Item, so after a disconnect + reconnect the same underlying bank
--    transactions come back under NEW transaction_ids. The ingest service only
--    fingerprints (user + date + amount + type + name + currency) rows that
--    were synced by a DIFFERENT plaid_item_id, so two genuinely identical
--    transactions from the same Item are never merged.
--
-- 2) plaid_pending_transaction_id records the pending transaction_id that a
--    posted transaction replaced (Plaid's pending_transaction_id), enabling
--    pending -> posted reconciliation to keep a single local row.
--
-- The unique index uq_transactions_plaid_id (V9) remains the database-level
-- guard against duplicate plaid_transaction_id inserts; the ingest layer adds
-- INSERT ... ON CONFLICT DO NOTHING for race-free concurrent syncs.
--
-- NOTE: these statements are idempotent and are also applied at startup by
-- DatabaseSchemaAutoPatch (this project does not execute Flyway at boot).

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS plaid_item_id VARCHAR(128);

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS plaid_pending_transaction_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_transactions_plaid_item
    ON transactions(plaid_item_id);


-- ── Optional manual cleanup of duplicates already created by reconnects ──────
-- Rows created before this change have plaid_item_id = NULL and cannot be
-- distinguished from same-Item rows, so no automatic deduplication is run.
-- To REVIEW candidate duplicates (same user, date, amount, type, name synced
-- by different Items), run this read-only query and inspect before deleting:
--
-- SELECT user_id, name, transaction_date, amount, type, COUNT(*)
-- FROM transactions
-- WHERE plaid_transaction_id IS NOT NULL
-- GROUP BY user_id, name, transaction_date, amount, type
-- HAVING COUNT(*) > 1;
