# Marketplace operations

## Local sandbox

1. Start PostgreSQL and create `marketplace` / `marketplace_test` databases.
2. Start the Marketplace Transaction Service: `npm run marketplace`
3. Start the labeled Locks / Paykit HTTP stub: `npm run locks:sandbox`
4. Start the Next.js app: `npm run dev`
5. Sign in with a Pubky recovery phrase
6. Open `/marketplace`

`npm run marketplace` sets `MARKETPLACE_MODE=sandbox` and `DATABASE_URL=postgres://marketplace:marketplace@127.0.0.1:5432/marketplace`. Restarting the service must preserve listings, orders, and ledger rows.

`npm run locks:sandbox` listens on `127.0.0.1:3101` (Locks client routes) and `127.0.0.1:3102` (Paykit `/setup`). It is a labeled stub: empty Paykit proofs only, no Bitcoin, no Bitkit, no Ring grant.

`npm run locks:wasm:smoke` checks the vendored unpublished Locks JS/WASM pin (`vendor/locks-sdk-wasm`, public asset `/locks-sdk/locks_sdk_wasm_bg.wasm`). Loading that package is not Bitkit companion approval.

Runtime defaults live in `src/libs/runtime-config/runtime-config.schema.ts`. Copy `.env.example` only when you need to override them.

The sandbox adapter is the local default (`PUBKY_RUNTIME_COMMERCE_ADAPTER_MODE=sandbox`) and is labeled in the UI. It does not move Bitcoin, custody funds, or issue real refunds. Production deployments should set `locks-paykit` or `unavailable`.

## Docker / companion topology

Use the pins and route contracts in [`upstream-integration.md`](upstream-integration.md) for:

- `pubky-homeserver`
- `pubky-docker`
- `paykit-server`
- `pubky/locks`
- Pubky Ring / Bitkit companion approval
- `pubky-ring-simulator` for local companion rehearsal

Locks is not escrow. Paykit discovers and exchanges payment data; Paykit Server currently observes BTC payments and cannot spend or refund.

## Recovery and isolation

Sign-out clears account-scoped Dexie commerce tables and the commerce Zustand store. Private carts, saved searches, and drafts must not leak across accounts.

## Health

The transaction service exposes `/health/live` and `/health/ready`. `/health/ready` reports `storage: postgres` when `DATABASE_URL` is set. Schema is applied from `services/marketplace/schema.sql` on connect. Authenticated sellers can read `/v1/analytics` for views, favorites, conversion, sell-through, and fulfillment health. `/v1/metrics` is a redacted public counter (listings, orders, events, confirmed payments, open reports, reserved-on-paid leftovers).

JSON responses set `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`. Sandbox POST `/v1/commands` and `/v1/attachments` require `x-marketplace-csrf: 1`. When `MARKETPLACE_ALLOWED_ORIGIN` is set to a concrete origin, the `Origin`/`Referer` must match.

The Locks / Paykit stub exposes `/health/live` and `/health/ready` on both ports and labels every response `sandbox`.

Operator routes (sandbox moderator only): `/v1/invariants` (includes `reservedOnPaidOrders`), `/v1/admin/search?q=`, and `/v1/admin/snapshot` (full repository JSON). `inventory.reconcile_paid` converts leftover reserved units on already-paid orders to sold and appends `inventory.reconciled` events. Account export is `/v1/account/export`. Risk signals are `/v1/risk-signals` and `trust.flag_risk`; they are append-only and never rewrite orders.

## Restore drill

Isolated restore is `exportSnapshot` → JSON → `hydrateSnapshot` on a fresh repository. Automated addresses:

- `services/marketplace/src/restore-drill.test.ts` (in-memory JSON round-trip; PostgreSQL file snapshot when `marketplace_test` is reachable)
- Process restart: `services/marketplace/src/postgres-repository.test.ts`

Manual sandbox procedure:

1. Export as the sandbox moderator (`'m'` × 52): `GET /v1/admin/snapshot` → `snapshot.json`.
2. Stop `npm run marketplace` (exact PID).
3. Recreate or truncate `marketplace` (`marketplace_snapshots`, events, ledger, aggregates, commands, outbox).
4. `INSERT INTO marketplace_snapshots (id, payload, updated_at) VALUES ('default', $snapshot::jsonb, now())`.
5. Start `npm run marketplace` and confirm `/health/ready` reports `storage: postgres`.
6. Re-read the same listing aggregate, order, and ledger; `GET /v1/invariants` must show no unbalanced orders.

Do not replay Paykit/Locks side effects from a restored snapshot. The drill restores marketplace authority only.

Checkout tax/shipping uses `sandbox-us-8pct-v1` and `sandbox-listing-shipping-v1`. Digital-only seller groups have $0 shipping. Pickup without listing options still uses the $12 flat quote. Physical listings can quote free, flat, or sandbox-calculated (`$6 + $4/kg`) shipping.
