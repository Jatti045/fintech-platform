ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_category VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS name_override VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_override VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS budget_override_id VARCHAR(36);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS budget_override_category VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS applied_rule_id VARCHAR(36);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS applied_rule_version BIGINT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rule_title VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rule_display_name VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rule_category VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rule_budget_category VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS legacy_name VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS legacy_category VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS legacy_budget_category VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rules_disabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE transactions ALTER COLUMN rules_disabled SET DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS legacy_classification BOOLEAN;
UPDATE transactions SET legacy_classification = TRUE WHERE legacy_classification IS NULL;
UPDATE transactions t SET legacy_budget_category = b.category FROM budgets b WHERE t.budget_id = b.id AND t.legacy_classification = TRUE AND t.legacy_budget_category IS NULL;
UPDATE transactions SET legacy_name = name, legacy_category = category WHERE legacy_classification = TRUE AND legacy_name IS NULL AND legacy_category IS NULL;
ALTER TABLE transactions ALTER COLUMN legacy_classification SET DEFAULT FALSE;
ALTER TABLE transactions ALTER COLUMN legacy_classification SET NOT NULL;
CREATE TABLE IF NOT EXISTS categorization_rules (
 id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id), title VARCHAR(255) NOT NULL,
 field VARCHAR(255) NOT NULL, match_mode VARCHAR(255) NOT NULL, match_text VARCHAR(255) NOT NULL,
 direction VARCHAR(255), account_id VARCHAR(255), provider_category_condition VARCHAR(255),
 category VARCHAR(255), budget_category VARCHAR(255), display_name VARCHAR(255),
 priority INTEGER NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, revision BIGINT NOT NULL DEFAULT 1,
 created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP(),
 effective_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CLOCK_TIMESTAMP()
);
ALTER TABLE categorization_rules ADD COLUMN IF NOT EXISTS effective_at TIMESTAMP WITH TIME ZONE;
UPDATE categorization_rules SET effective_at = created_at WHERE effective_at IS NULL;
ALTER TABLE categorization_rules ALTER COLUMN effective_at SET DEFAULT CLOCK_TIMESTAMP();
ALTER TABLE categorization_rules ALTER COLUMN effective_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rules_user_priority ON categorization_rules(user_id, priority);
CREATE TABLE IF NOT EXISTS rule_applications (
 id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id), rule_id VARCHAR(36),
 changes_json TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL, undone_at TIMESTAMP WITH TIME ZONE
);
CREATE TABLE IF NOT EXISTS pending_classification_handoffs (
 id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
 item_id VARCHAR(255) NOT NULL, account_id VARCHAR(255) NOT NULL, pending_id VARCHAR(255) NOT NULL,
 choices_json TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 UNIQUE(user_id,item_id,account_id,pending_id)
);
