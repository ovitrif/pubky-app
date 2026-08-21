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

## Native Lock Server / Paykit Server (no Docker)

This cloud environment has no Docker. The pinned `pubky/locks` and `pubky/paykit-server` trees were compiled with their toolchain pins and booted against local PostgreSQL:

```bash
# locks-server (Rust 1.89.0) — do not bind :3000; Next.js already uses it
PUBKY_LOCK_DATABASE_URL=postgres://marketplace:marketplace@127.0.0.1:5432/locks \
  locks-server --config ~/.pubky-lock/config.toml
# bind_addr = "127.0.0.1:3103"

# paykit-server (Rust 1.91.1)
PAYKIT_CONFIG=./config.toml \
PAYKIT_DATABASE_URL=postgres://marketplace:marketplace@127.0.0.1:5432/paykit \
PAYKIT_MASTER_KEY=<32-byte-base64url> \
  paykit-server
# listen_addr = "127.0.0.1:3104"
```

Verified locally: Lock Server `GET /healthz` → `{"status":"ok"}` and `GET /readyz` → persisted worker ready. Paykit Server `GET /health/live` → live and `GET /health/ready` → postgres / electrum adapter / paykit_delivery / outbox ready. `GET /setup` with an exact allowed `return_to` origin renders a Paykit auth URL and does not embed an xpub.

A native `pubky-testnet` (homeserver 0.11.0) also boots without Docker:

```bash
TEST_PUBKY_CONNECTION_STRING='postgres://marketplace:marketplace@127.0.0.1:5432/postgres?pubky-test=true' \
  pubky-testnet
```

It owns DHT `:6881`, Pkarr `:15411`, HTTP relay `:15412`, homeserver ICANN `:6286`, and admin `:6288`. Start it before `locks-server` so Mainline can bootstrap. After that order, Lock Server no longer logs routing-table bootstrap failures.

This is not Bitkit companion approval. There is no live Electrum/Bitcoin chain. The marketplace app still defaults to `npm run locks:sandbox` on `:3101` / `:3102`. Point `PUBKY_RUNTIME_COMMERCE_ADAPTER_MODE=locks-paykit` at these processes only after Lock Server creator-authority and Bitkit setup succeed.

Verified against this topology with `LOCK_SERVER_URL=http://127.0.0.1:3103` and `allowed_return_origins = ["http://localhost:3000"]`:

- `scripts/dev-legacy-connect-testnet.sh auth` — hosted `/connect` shell, Pubky SDK approve-auth, `POST /frontend-sessions` 200
- `scripts/dev-legacy-connect-testnet.sh locked-content` — create lock, upload `example.txt`, submit proof bundle, **development** `/verification-task-completions` marks the task completed, issue credential, `GET /priv-resources/content/example.txt` returns `guarded bytes`

The completion route is a Lock Server development gate. It is not a Paykit invoice and not Bitkit approval.

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

Privileged staff commands (`trust.decide`, `trust.reverse`, `risk.hold`, `risk.release`, `refund.record_external`, `inventory.reconcile_paid`) also require `x-marketplace-step-up` from `POST /v1/auth/step-up`. Tokens are HMAC-bound to actor and purpose and expire in five minutes. Support notes and ordinary buyer/seller commands do not use step-up.

`POST /v1/callbacks/locks-payment` is service-to-service. It skips CSRF/origin and requires `x-marketplace-callback-timestamp`, `x-marketplace-callback-nonce`, and `x-marketplace-callback-signature` (HMAC-SHA256 over `v1.{timestamp}.{nonce}.{sha256(body)}`). Nonces are single-use inside a five-minute window. Override the labeled sandbox secrets with `MARKETPLACE_CALLBACK_SECRET` and `MARKETPLACE_STEP_UP_SECRET` (minimum 16 characters). Do not log raw callback bodies or tokens.

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
6. Re-read the same listing aggregate, order (including the buyer delivery address from the snapshot), and ledger; `GET /v1/invariants` must show no unbalanced orders. The denormalized `marketplace_aggregates` order payload omits `deliveryAddress`; the snapshot is the restart source of truth.

Do not replay Paykit/Locks side effects from a restored snapshot. The drill restores marketplace authority only.

Checkout tax/shipping uses `sandbox-us-8pct-v1` and `sandbox-listing-shipping-v1`. Digital-only seller groups have $0 shipping. Pickup without listing options still uses the $12 flat quote. Physical listings can quote free, flat, or sandbox-calculated (`$6 + $4/kg`) shipping. `sandbox-carrier-table-v1` labels Sandbox Post / Express / Returns and zone surcharges; US Sandbox Post stays equal to the calculated listing quote. `fulfillment.record_exception` records one delayed/lost/damaged/refused fact on an in-flight shipment and does not refund. Reverse labels are printable sandbox documents only.
