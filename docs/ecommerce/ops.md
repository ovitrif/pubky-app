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

Operator routes (sandbox moderator only): `/v1/invariants` (includes `reservedOnPaidOrders`) and `/v1/admin/search?q=`. `inventory.reconcile_paid` converts leftover reserved units on already-paid orders to sold and appends `inventory.reconciled` events. Account export is `/v1/account/export`. Risk signals are `/v1/risk-signals` and `trust.flag_risk`; they are append-only and never rewrite orders.

Checkout tax/shipping uses `sandbox-us-8pct-v1` and `sandbox-flat-1200-v1`. Digital-only seller groups have $0 shipping. Pickup still uses the flat sandbox shipping quote.
