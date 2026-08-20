-- Durable Marketplace Transaction Service schema.
-- Applied on startup when DATABASE_URL is set. The in-memory repository
-- remains the unit-test default.

CREATE TABLE IF NOT EXISTS marketplace_aggregates (
  aggregate_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  seller_pubky TEXT,
  buyer_pubky TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_events (
  event_id UUID PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  actor_pubky TEXT NOT NULL,
  command_id UUID NOT NULL,
  kind TEXT NOT NULL,
  revision BIGINT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

DROP INDEX IF EXISTS marketplace_events_command_actor_idx;
CREATE INDEX IF NOT EXISTS marketplace_events_command_actor_idx
  ON marketplace_events (actor_pubky, command_id);
CREATE INDEX IF NOT EXISTS marketplace_events_aggregate_idx
  ON marketplace_events (aggregate_id, revision);

CREATE TABLE IF NOT EXISTS marketplace_ledger_entries (
  entry_id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  account TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  exponent SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS marketplace_ledger_order_idx
  ON marketplace_ledger_entries (order_id);

CREATE TABLE IF NOT EXISTS marketplace_outbox (
  outbox_id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES marketplace_events (event_id),
  destination TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_snapshots (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_commands (
  actor_pubky TEXT NOT NULL,
  command_id UUID NOT NULL,
  request_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  PRIMARY KEY (actor_pubky, command_id)
);
