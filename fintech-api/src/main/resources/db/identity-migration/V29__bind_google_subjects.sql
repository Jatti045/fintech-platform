ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_subject ON users(google_subject);

CREATE TABLE IF NOT EXISTS google_identity_challenges (
    email VARCHAR(255) PRIMARY KEY,
    google_subject VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    target_user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0
);

-- Old JWTs do not record whether Google email-only authentication issued them.
-- Require one fresh sign-in, for every account, without guessing a subject binding.
UPDATE users SET session_version = session_version + 1,
                 update_version = update_version + 1,
                 updated_at = clock_timestamp();
