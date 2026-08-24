-- Removes the Goals feature, which was never reachable from any client UI.
--
-- Order matters because of foreign keys:
--   1. transactions.goal_id references goals(id)  -> drop constraint + column first
--   2. goal_allocations.goal_id references goals(id) -> drop the whole table
--   3. drop the goals table last
--
-- Column indexes (idx_transactions_goal_id, idx_goals_user_id and the
-- goal_allocations indexes) are dropped automatically with their columns/
-- tables by PostgreSQL.

ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS fk_transaction_goal;

ALTER TABLE transactions
    DROP COLUMN IF EXISTS goal_id;

DROP TABLE IF EXISTS goal_allocations;

DROP TABLE IF EXISTS goals;
