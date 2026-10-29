-- Existing JWTs without a sessionVersion claim belong to version zero.
-- Every successful password update advances this database-owned value.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version BIGINT NOT NULL DEFAULT 0;
