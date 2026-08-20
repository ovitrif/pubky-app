# Marketplace Transaction Service

This is the server-authoritative marketplace sequencer defined by ADR 0019.

Current slice:

- versioned command API for inventory, offers, auctions, checkout, fulfillment, reviews, and trust;
- actor-scoped idempotency and expected-revision conflicts;
- serialized command execution with a balanced integer-minor ledger;
- append-only events plus an outbox row per event;
- PostgreSQL persistence when `DATABASE_URL` is set;
- in-memory repository for unit tests;
- `/health/live` and `/health/ready` (ready only in sandbox mode).

Run locally with durable storage:

```bash
npm run marketplace
```

`npm run marketplace:start` now enables sandbox mode. Without `DATABASE_URL` it stays in-memory. The service listens on `127.0.0.1:3100` by default.

PostgreSQL schema lives in `schema.sql` and is applied on connect. This prototype is still non-custodial: Paykit does not execute payments, Locks is not escrow, and refunds are recorded as external evidence only.
