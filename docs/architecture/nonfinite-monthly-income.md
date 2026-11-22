# Nonfinite monthly income

The standalone update binds income as a `Double`. Jackson converts an overflowing positive number such as `1e1000` to positive infinity. Hibernate Validator's `@DecimalMin` accepts that value and the old application condition only checked whether the value was negative. PostgreSQL V6 uses `double precision` without a finiteness constraint, so the baseline was stored and the profile serialized it as the string `"Infinity"`.

The update domain now rejects all nonfinite values, including when constructing a change directly. The HTTP controller maps its rejection to the existing error envelope with status 400 and message `Monthly income must be finite.`. Validations that already reject the request remain in place. The shared `MonthlyIncomeService.upsertForMonth` also rejects nonfinite amounts before locking or persisting anything within that method. Both production callers use this upsert. Account setup already checks finiteness after converting its decimal input. The historical V7 backfill and database schema are unchanged.

With valid period fields, positive overflow and quoted positive infinity reach the new application check. Negative overflow, quoted negative infinity and quoted NaN return the existing validation response. An unquoted NaN token returns the existing invalid-payload response. Direct calls reject positive infinity, negative infinity and NaN. Finite amounts retain the existing precision and behavior, including zero and carry-forward.

## Read-only diagnostic

Run only against an authorized database using a read-only connection. The query returns record and owner IDs, the month and a label for the offending value. Keep the resulting identifiers within the approved investigation.

```sql
SELECT id, user_id, month_start, income::text AS nonfinite_income
FROM user_monthly_incomes
WHERE income IN ('Infinity'::double precision, '-Infinity'::double precision, 'NaN'::double precision)
ORDER BY user_id, month_start, id;
```

PostgreSQL equality matches its `NaN` value. The query works independently of transaction history, exchange rates and profile settings. It is a read-only scan over stored baselines.

Each affected baseline can carry forward through months before the owner's next configured baseline. Profile and legacy expected-income reads can propagate the stored value. Reporting rounds expected income through `BigDecimal.valueOf`, which rejects nonfinite numbers even if positive actual income exists. Requests for affected periods can therefore fail.

If the diagnostic finds affected rows, establish the intended amounts from an authorized source before correcting them. Scope and review the rows, apply verified corrections atomically with existing owner-write coordination, audit the changes, and evict each affected owner's summary cache after commit. Verify the corrected periods through profile and report reads. If values cannot be promptly recovered, separately approve explicit read-path containment that reports the invalid baseline without presenting a fabricated amount. Production diagnosis and any correction require separate authorization. This increment does not repair stored data or change how reads represent it.

The diagnostic was tested against the migrated schema on disposable PostgreSQL. It found all three synthetic nonfinite rows and excluded zero and a finite positive control. After rolling back those fixtures, the same query returned zero rows in a read-only transaction on that test database. This says nothing about the contents of production.
