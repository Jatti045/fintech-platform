-- Independent of the transaction row so a retry cannot resurrect a deleted entry.
-- Account deletion also erases the stored creation results.
DO $migration$
BEGIN
    -- Serialize this additive patch if multiple API replicas start together.
    PERFORM pg_advisory_xact_lock(1920148834, 29);
    CREATE TABLE IF NOT EXISTS transaction_submissions (
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_id UUID NOT NULL,
        request_fingerprint VARCHAR(64) NOT NULL,
        response_json TEXT NOT NULL,
        PRIMARY KEY (user_id, submission_id)
    );
END
$migration$;
