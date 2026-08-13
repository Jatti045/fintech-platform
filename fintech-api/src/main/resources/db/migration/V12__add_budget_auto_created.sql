-- Plaid auto-created categories are flagged as unbudgeted until the user
-- assigns a limit. New installs get the column from the entity model; this
-- backfills existing databases.

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_auto_created BOOLEAN NOT NULL DEFAULT FALSE;
