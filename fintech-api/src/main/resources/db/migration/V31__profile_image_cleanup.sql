DO $migration$
BEGIN
    PERFORM pg_advisory_xact_lock(1920148834, 31);
    CREATE TABLE IF NOT EXISTS profile_image_cleanup_jobs (
        public_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        lease_owner UUID,
        lease_expires_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_profile_image_cleanup_due ON profile_image_cleanup_jobs(next_attempt_at);
END
$migration$;
