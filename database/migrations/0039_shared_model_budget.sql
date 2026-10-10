-- The primary channel stores the account-wide rolling model-call ledger. Local receipt IDs
-- belong to isolated databases, so the composite key includes their editorial channel.
CREATE TABLE IF NOT EXISTS model_budget_attempts (
  channel text NOT NULL,
  local_attempt_id bigint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel, local_attempt_id)
);
CREATE INDEX IF NOT EXISTS model_budget_attempts_started_at ON model_budget_attempts (started_at);
