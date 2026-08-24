BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users) THEN
        RAISE EXCEPTION 'No user found in the database. Please create a user first.';
    END IF;
END $$;

-- Creates 5 budgets the way the app expects them: one user, month-scoped date, zero spent initially.
WITH seed_user AS (
    SELECT id
    FROM users
    ORDER BY created_at
    LIMIT 1
), month_context AS (
    SELECT (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS month_start
)
INSERT INTO budgets (id, date, category, budget_limit, spent, icon, user_id, created_at, updated_at)
SELECT b.id, mc.month_start, b.category, b.budget_limit, 0, b.icon, u.id, NOW(), NOW()
FROM (
    VALUES
        ('22222222-2222-2222-2222-000000000001', 'Food',          1200::double precision, 'coffee'),
        ('22222222-2222-2222-2222-000000000002', 'Transport',      650::double precision, 'car'),
        ('22222222-2222-2222-2222-000000000003', 'Entertainment',  500::double precision, 'film'),
        ('22222222-2222-2222-2222-000000000004', 'Shopping',       800::double precision, 'shopping-bag'),
        ('22222222-2222-2222-2222-000000000005', 'Bills',          900::double precision, 'file-text')
) AS b(id, category, budget_limit, icon)
CROSS JOIN seed_user u
CROSS JOIN month_context mc;

-- Creates 50 EXPENSE transactions with realistic names/amounts/dates and then backfills spent totals.
INSERT INTO transactions (
    id,
    name,
    transaction_date,
    category,
    type,
    amount,
    original_amount,
    original_currency,
    icon,
    description,
    user_id,
    budget_id,
    created_at,
    updated_at
)
WITH seed_user AS (
    SELECT id
    FROM users
    ORDER BY created_at
    LIMIT 1
), month_context AS (
    SELECT (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS month_start
), budget_lookup AS (
    SELECT *
    FROM (
        VALUES
            (0, '22222222-2222-2222-2222-000000000001', 'coffee'),
            (1, '22222222-2222-2222-2222-000000000002', 'car'),
            (2, '22222222-2222-2222-2222-000000000003', 'film'),
            (3, '22222222-2222-2222-2222-000000000004', 'shopping-bag'),
            (4, '22222222-2222-2222-2222-000000000005', 'file-text')
    ) AS bl(bucket_index, budget_id, budget_icon)
), categories AS (
    SELECT ARRAY['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Groceries']::text[] AS names
), transaction_names AS (
    SELECT ARRAY[
        'Coffee',
        'Lunch',
        'Dinner',
        'Uber ride',
        'Gas',
        'Movie tickets',
        'Netflix subscription',
        'Grocery shopping',
        'Online shopping',
        'Electric bill',
        'Water bill',
        'Internet bill',
        'Doctor visit',
        'Pharmacy',
        'Books',
        'Course subscription',
        'Restaurant',
        'Fast food',
        'Taxi',
        'Bus ticket',
        'Train ticket',
        'Concert tickets',
        'Gaming',
        'Clothes',
        'Shoes',
        'Rent',
        'Insurance',
        'Gym membership',
        'Phone bill',
        'Parking'
    ]::text[] AS names
)
SELECT
    '11111111-1111-1111-1111-' || LPAD(gs::text, 12, '0') AS id,
    transaction_names.names[((gs - 1) % array_length(transaction_names.names, 1)) + 1] AS name,
    mc.month_start + make_interval(days => ((gs - 1) % 28), hours => 12, mins => ((gs - 1) % 5) * 7) AS transaction_date,
    categories.names[((gs - 1) % array_length(categories.names, 1)) + 1] AS category,
    'EXPENSE' AS type,
    ROUND((5 + (((gs * 13) % 150)::numeric / 10)), 2)::double precision AS amount,
    NULL AS original_amount,
    NULL AS original_currency,
    bl.budget_icon AS icon,
    'Transaction #' || gs AS description,
    u.id AS user_id,
    bl.budget_id,
    NOW() AS created_at,
    NOW() AS updated_at
FROM generate_series(1, 50) AS gs
CROSS JOIN seed_user u
CROSS JOIN month_context mc
CROSS JOIN categories
CROSS JOIN transaction_names
JOIN budget_lookup bl ON bl.bucket_index = ((gs - 1) % 5);

UPDATE budgets b
SET spent = COALESCE(expense_totals.total_spent, 0),
    updated_at = NOW()
FROM (
    SELECT budget_id, SUM(amount) AS total_spent
    FROM transactions
    WHERE type = 'EXPENSE'
      AND budget_id IN (
          '22222222-2222-2222-2222-000000000001',
          '22222222-2222-2222-2222-000000000002',
          '22222222-2222-2222-2222-000000000003',
          '22222222-2222-2222-2222-000000000004',
          '22222222-2222-2222-2222-000000000005'
      )
    GROUP BY budget_id
) expense_totals
WHERE b.id = expense_totals.budget_id;

COMMIT;

