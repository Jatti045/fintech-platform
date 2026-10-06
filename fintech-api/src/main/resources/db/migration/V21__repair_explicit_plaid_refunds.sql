-- Existing imports used positive INCOME magnitudes for all Plaid credits.
-- Repair only explicit refund evidence; never guess a purchase from amount/date.
CREATE TEMP TABLE plaid_refund_repairs ON COMMIT DROP AS
SELECT id, user_id, budget_id AS old_budget_id, category,
       date_trunc('month', transaction_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS month_start
FROM transactions
WHERE plaid_transaction_id IS NOT NULL AND type = 'INCOME' AND amount > 0
  AND is_transfer = FALSE
  AND (UPPER(COALESCE(plaid_pfc_detailed, '')) IN ('TRANSFER_IN_REFUND', 'TRANSFER_REFUND')
       OR (UPPER(COALESCE(plaid_pfc_detailed, '')) NOT LIKE 'INCOME_%'
           AND UPPER(COALESCE(plaid_pfc_detailed, '')) NOT IN
               ('TRANSFER_IN_DEPOSIT', 'TRANSFER_IN_PAYROLL', 'TRANSFER_IN_ACCOUNT_TRANSFER')
           AND UPPER(category) NOT LIKE 'INCOME%'
           AND (name ~* '\mREFUND\M' OR category ~* '\mREFUND\M')));

INSERT INTO budgets (id, date, category, budget_limit, spent, is_auto_created, user_id, created_at, updated_at)
SELECT gen_random_uuid()::text, month_start, category, 0, 0, TRUE, user_id, NOW(), NOW()
FROM (SELECT DISTINCT ON (user_id, LOWER(TRIM(category)), month_start)
             user_id, category, month_start FROM plaid_refund_repairs
      ORDER BY user_id, LOWER(TRIM(category)), month_start) refunds
ON CONFLICT (user_id, LOWER(TRIM(category)), date) DO NOTHING;

UPDATE transactions t
SET type = 'EXPENSE', amount = -ABS(t.amount), budget_id = b.id, updated_at = NOW()
FROM plaid_refund_repairs r JOIN budgets b
  ON b.user_id = r.user_id AND LOWER(TRIM(b.category)) = LOWER(TRIM(r.category)) AND b.date = r.month_start
WHERE t.id = r.id;

-- Signed SUM is the source of truth, including credits that precede purchases.
UPDATE budgets b SET spent = (
    SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
    WHERE t.budget_id = b.id AND t.type = 'EXPENSE' AND t.is_transfer = FALSE)
WHERE b.id IN (SELECT old_budget_id FROM plaid_refund_repairs
               UNION SELECT t.budget_id FROM transactions t JOIN plaid_refund_repairs r ON t.id = r.id);
