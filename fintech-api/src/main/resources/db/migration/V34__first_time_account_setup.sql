-- Grandfather rows already present, then require setup for subsequent accounts.
ALTER TABLE users ADD COLUMN setup_complete BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN setup_complete SET DEFAULT FALSE;
