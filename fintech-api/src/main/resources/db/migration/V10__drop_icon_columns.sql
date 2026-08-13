-- Budgets and transactions no longer carry category icons.
-- The application entity model and DatabaseSchemaAutoPatch no longer create
-- these columns; this migration cleans up databases created before the removal.

ALTER TABLE budgets DROP COLUMN IF EXISTS icon;
ALTER TABLE transactions DROP COLUMN IF EXISTS icon;
