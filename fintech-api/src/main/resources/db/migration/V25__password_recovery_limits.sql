ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS password_recovery_limits (
    bucket_key VARCHAR(96) PRIMARY KEY,
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    next_allowed_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_recovery_limits_window ON password_recovery_limits(window_started_at);
