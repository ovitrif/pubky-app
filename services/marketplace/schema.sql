-- Durable Marketplace Transaction Service schema.
-- The sandbox prototype still uses the in-memory repository; this is the target PostgreSQL model.

CREATE TABLE marketplace_aggregates (
  aggregate_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  seller_pubky TEXT,
  buyer_pubky TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE marketplace_events (
  event_id UUID PRIMARY KEY,
  aggregate_id TEXT NOT NULL REFERENCES marketplace_aggregates (aggregate_id),
  actor_pubky TEXT NOT NULL,
  command_id UUID NOT NULL,
  kind TEXT NOT NULL,
  revision BIGINT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX marketplace_events_command_actor_idx ON marketplace_events (actor_pubky, command_id);
CREATE INDEX marketplace_events_aggregate_idx ON marketplace_events (aggregate_id, revision);

CREATE TABLE marketplace_ledger_entries (
  entry_id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  account TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  exponent SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX marketplace_ledger_order_idx ON marketplace_ledger_entries (order_id);

CREATE TABLE marketplace_outbox (
  outbox_id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES marketplace_events (event_id),
  destination TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_error TEXT
);
