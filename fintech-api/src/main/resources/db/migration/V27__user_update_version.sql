-- Preserve existing fields while enabling optimistic protection for every User entity write.
ALTER TABLE users ADD COLUMN IF NOT EXISTS update_version BIGINT NOT NULL DEFAULT 0;
