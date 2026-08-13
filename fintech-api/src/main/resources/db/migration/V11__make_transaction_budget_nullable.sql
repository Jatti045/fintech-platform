-- Income transactions may exist without a linked budget. Make the
-- transactions.budget_id column nullable (previously NOT NULL).

ALTER TABLE transactions ALTER COLUMN budget_id DROP NOT NULL;
