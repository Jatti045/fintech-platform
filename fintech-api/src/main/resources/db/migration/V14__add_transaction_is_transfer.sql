-- Internal transfers between a user's own accounts are movement of existing
-- money: they must stay in the transaction history but never contribute to
-- income or expense analytics (monthly income, spending totals, budget spent,
-- summaries, charts).
--
-- Plaid transactions are flagged is_transfer = TRUE at ingestion time when
-- their structured category indicates a transfer (personal_finance_category
-- TRANSFER_IN/TRANSFER_OUT, or the legacy top-level "Transfer" category).
-- The raw Plaid category codes are NOT persisted, so historical rows cannot
-- be backfilled reliably and are left at the default FALSE.
--
-- Idempotent; also applied at startup by DatabaseSchemaAutoPatch (this project
-- does not execute Flyway at boot).

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN NOT NULL DEFAULT FALSE;
