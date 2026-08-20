# Marketplace operations

## Local sandbox

1. Start PostgreSQL and create `marketplace` / `marketplace_test` databases.
2. Start the Marketplace Transaction Service: `npm run marketplace`
3. Start the Next.js app: `npm run dev`
4. Sign in with a Pubky recovery phrase
5. Open `/marketplace`

`npm run marketplace` sets `MARKETPLACE_MODE=sandbox` and `DATABASE_URL=postgres://marketplace:marketplace@127.0.0.1:5432/marketplace`. Restarting the service must preserve listings, orders, and ledger rows.

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

The transaction service exposes `/health/live` and `/health/ready`. `/health/ready` reports `storage: postgres` when `DATABASE_URL` is set. Schema is applied from `services/marketplace/schema.sql` on connect.

Operator routes (sandbox moderator only): `/v1/invariants` and `/v1/admin/search?q=`. Account export is `/v1/account/export`.
