# Pubky Marketplace Implementation Plan

Status: active  
Goal: a working, feature-complete eBay/Depop-class prototype integrated with Paykit and Pubky Locks.

## Progress snapshot

Last reviewed: 2026-08-21  
Stopped at: **T8 — Hardening and parity audit** (native Paykit companion-auth + undetected invoice; live Bitkit remains)

Legend:

- `[x]` done for this sandbox prototype
- `[~]` partial / in progress
- `[!]` stopped here
- `[ ]` pending

Feature slices T0–T7 have reachable sandbox UI and service commands. The remaining program of work is quality, verification, durable persistence, real Paykit/Locks/Bitkit contract proof, docs, and videos.

### Task graph

- [x] **T0 — Evidence and protocol audit** — upstream pins and constraints recorded; acceptance-to-test ledger in `docs/ecommerce/acceptance-to-test-ledger.md`
- [x] **T1 — Architecture and contracts** — ADRs 0019/0020, Zod contracts, threat model; PostgreSQL schema applied on connect
- [x] **T2 — Local-first foundation** — Dexie models, controllers, in-memory tests plus PostgreSQL write-through repository
- [x] **T3 — Catalog and discovery** — shops, listings, filters, favorites, follows, saved searches, feed sections
- [x] **T4 — Messaging, offers, and auctions** — proxy bids, visible bid history, anti-sniping, watcher-only offers, auto-accept thresholds, increment-shill auto-flags
- [x] **T5 — Checkout, Paykit, and Locks** — cart, checkout, sandbox payment advance, Locks client hooks, labeled HTTP stub, and vendored unpublished Locks JS/WASM; native Paykit companion-auth + Locks invoice (undetected); live Bitkit unverified
- [x] **T6 — Fulfillment and post-purchase** — cancel, ship, return, external refund, dispute, review, report; moderator assign/decide/reverse + risk flags
- [x] **T7 — Seller operations** — dashboard, bulk pause/activate/delete, CSV export/import, promotions, statements, payouts, blocked buyers
- [~] **T8 — Hardening and parity audit** `[!]` **stopped here** — trust indicators, guarantee terms, buyer payment labels, support/finance/risk role split, HMAC-signed Locks payment callbacks with a 5-minute replay window, staff step-up tokens, 100-way checkout/bid/close/payment concurrency, enforced Next nonce CSP, DNS rebinding, restore drill; native companion-auth invoice recorded; live Bitkit remains
- [~] **T9 — Documentation and demonstrations** — plan, ADRs, upstream, threat model, ops runbook, acceptance ledger; signed-in checkout, digital-delivery, operator-moderation, and seller dashboard/listing-form videos recorded without the phrase; live Bitkit motion remains

### Delivery slices

- [x] 1. Marketplace shell + sandbox catalog + listing creation
- [x] 2. Discovery + favorites/follows + seller shop
- [x] 3. Durable transaction service + inventory/ledger foundations — PostgreSQL snapshot + events/ledger/outbox tables
- [x] 4. Messaging + offers + concurrency-safe auctions
- [x] 5. Cart + checkout + sandbox order/payment lifecycle
- [~] 6. Real Locks/Paykit adapter + Bitkit/Ring setup — client lifecycle + labeled HTTP stub + vendored Locks JS/WASM; native companion-auth setup + Locks `paykit-payment` invoice (`undetected`); Bitkit and chain observation not proven
- [x] 7. Fulfillment + returns/refunds/disputes/reviews
- [~] 8. Seller analytics + moderation + hardening — views/favorites/conversion/sell-through + fulfillment health; trust labels; guarantee terms; buyer payment status; support/finance/risk consoles; signed callbacks + staff step-up; 100-way concurrency; enforced CSP + DNS rebinding + restore drill; live Bitkit and remaining videos remain
- [ ] 9. Full parity audit, documentation, and final videos

### Where we stopped

Last shipped feature work: auction/offer winning orders with address confirmation, plus listing purchase actions kept above the fold at 390×844.

Next required work, in order:

1. Prove live Bitkit/Paykit companion flows against the pinned Docker topology. Native `paykit-companion-auth` plus an undetected Paykit invoice is not Bitkit approval. The local stub is not that proof.
2. Close T8: broader VRT/E2E coverage and keep the verification ledger current.
3. Close T9: record live Bitkit motion and remaining responsive/accessibility videos without capturing the recovery phrase.

### Reachable routes

| Route                                | Surface                                           |
| ------------------------------------ | ------------------------------------------------- |
| `/marketplace`                       | Catalog, search, filters                          |
| `/marketplace/listing/[seller]/[id]` | Listing, cart, offer, bid, message, Locks, report |
| `/marketplace/shop/[seller]`         | Public shop + follow                              |
| `/marketplace/sell`                  | Listing studio + draft autosave                   |
| `/marketplace/cart`                  | Multi-item cart                                   |
| `/marketplace/orders`                | Orders, sandbox payment, fulfillment actions      |
| `/marketplace/offers`                | Offer inbox                                       |
| `/marketplace/messages`              | Listing-scoped inbox                              |
| `/marketplace/notifications`         | Activity + preferences                            |
| `/marketplace/dashboard`             | Seller inventory/analytics                        |
| `/marketplace/settings`              | Shop policies + Paykit/Locks setup                |
| `/marketplace/moderation`            | Open trust reports                                |
| `/marketplace/support`               | Redacted order evidence + non-financial notes     |
| `/marketplace/risk`                  | Fraud signals + transaction holds                 |
| `/marketplace/finance`               | Ledger reconcile + external refunds               |

## Definition of complete

The prototype is complete only when:

1. Every capability in the acceptance matrix below has a reachable desktop and mobile flow.
2. Commerce state survives reloads and account changes without leaking data between users.
3. Public marketplace records sync through Pubky homeserver paths and work locally first.
4. A durable server-authoritative transaction service arbitrates bids, reservations, orders, payment facts, refunds, and ledger entries; Dexie only mirrors these states.
5. A real adapter exercises the Locks → Paykit Server invoice and payment-status flow.
6. A deterministic sandbox adapter exercises every payment, timeout, failure, refund, and dispute branch without real funds.
7. Automated tests cover domain transitions, persistence, adapters, forms, routes, accessibility-critical behavior, and representative visual surfaces.
8. Adversarial concurrency tests prove one winner for scarce inventory and auctions and at-most-once financial transitions. — 100-way reserve, checkout last-unit, last-bid, auction close, and payment confirm
9. End-to-end walkthroughs cover buyer, seller, bidder, moderator, support, and operator journeys. — Cypress signed-in plus staff-console video for support/finance/risk; live Bitkit remains
10. The final verification ledger contains no unresolved required finding.
11. Final videos demonstrate all feature groups.

This is a pre-production prototype, not a claim of production eBay parity. Paykit, Locks, and Paykit Server explicitly describe themselves as WIP or pre-production. Paykit discovers and exchanges payment data but does not execute payments. Locks gates resources after proofs; it is not escrow. Paykit Server currently observes BTC payments but cannot spend, refund, issue receipts, or process payer proof events. The UI must label simulated, detected, confirmed, refund-pending, and externally-refunded states accurately.

## Verified upstream constraints

| Dependency            | Verified capability                                                                                                             | Integration consequence                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pubky/paykit-rs`     | Public/private payment endpoints, encrypted links, payment requests/proofs, encrypted receipts; Rust plus Swift/Kotlin bindings | No browser binding exists. Web integration must use a service boundary; Bitkit/Pubky Ring can own companion approval and wallet execution.          |
| `pubky/paykit-server` | Signed invoice creation/status routes, Bitkit companion setup, unique BIP84 addresses, confirmation observation                 | Only a trusted Locks service may call business routes. It is receiver-side, BTC-only, single-process, and cannot refund.                            |
| `pubky/locks`         | Lock policies, proof submission, verification polling, entitlement/access credentials, browser JS/WASM SDK, Paykit verifier     | Use for paid digital delivery and proof-backed access, never as custody or general buyer protection.                                                |
| `@synonymdev/pubky`   | Browser Pubky sessions, homeserver storage, public storage, auth URLs                                                           | Reuse current app auth and homeserver service. Existing app grant is `/pub/pubky.app/:rw`; private Locks creator authority remains a separate flow. |
| `pubky-app-specs`     | Posts support a `lock` link                                                                                                     | Marketplace previews may point at a Locks policy without changing post wire format.                                                                 |

Upstream references:

- <https://github.com/pubky/paykit-rs>
- <https://github.com/pubky/paykit-server>
- <https://github.com/pubky/locks>
- Exact audited revisions, route contracts, settlement semantics, and local topology: [`upstream-integration.md`](upstream-integration.md)

The requested `pubky/design.md` is not a GitHub repository and no `design.md` file is currently discoverable in the Pubky organization. Until an authoritative file is located, the implementation follows this repository's Shadcn/Tailwind design tokens and component rules.

## Product roles

- Guest: browse, search, filter, inspect sellers, listings, bids, and reviews.
- Buyer: favorite/follow, message, offer, bid, cart, pay, track, cancel, return, dispute, and review.
- Seller: create a shop, list inventory, negotiate, fulfill, refund externally, resolve disputes, and inspect analytics.
- Moderator: review reports, restrict listings/users, record decisions, and audit actions.
- Support: inspect scoped order evidence and administer non-financial resolutions.
- Risk: apply transaction holds, investigate fraud signals, and release reviewed activity.
- Finance: reconcile the sandbox ledger and record externally executed refunds without gaining moderation powers.
- Operator: configure adapters, inspect health, run migrations, and execute the verification suite.

## Acceptance matrix

Status on each requirement as of 2026-08-20. `[x]` means a reachable sandbox flow exists; `[~]` means schema or a subset exists; `[ ]` means not built.

### Identity, shop, and trust

- [x] Existing Pubky sign-in and recovery continue to work.
- [x] A signed-in user can create and edit shop name, bio, policies, location granularity, vacation mode, and default shipping/return settings.
- [x] Public seller pages show active/sold listings, followers, sales, ratings, response time, and policy summaries.
- [x] Follow/block/report actions are auth-gated and immediately reflected locally. — follow, listing report, seller-blocked buyers, and conversation block
- [x] Trust indicators distinguish verified facts from self-declared profile fields. — shop/PDP `MarketplaceTrustIndicators` splits transaction-service facts from seller-declared copy

### Listings and inventory

- [x] Sellers can create draft, fixed-price, auction, digital, and watcher-only offer listings. — sell form includes Digital download and Watcher-only offer; sandbox catalog includes Sewing pattern pack and Sample-room wool coat
- [x] Required fields include title, description, category, condition, price/currency, quantity, location granularity, delivery options, and media.
- [x] Variants/SKUs support independent price, quantity, and status. — up to three named option dimensions, form editor, PDP selector
- [x] Media can be reordered, captioned, validated, retried, and removed. — up to 12 photos, cover-first reorder, per-photo captions
- [x] Drafts autosave. Publish, edit, duplicate, pause, reserve, sell, relist, and delete transitions are enforced. — dedicated relist studio creates a new active listing with price/quantity
- [x] Quantity cannot become negative; reserved inventory expires or converts atomically.
- [x] Public records carry a schema version and stable `seller:listId` identifier.

### Discovery and social shopping

- [x] Marketplace home exposes recommended, following, new, ending-soon, recently viewed, and category sections.
- [x] Search supports text, seller, category, condition, format, price range, delivery, location, sort, and saved searches.
- [x] Listing grids support pagination, empty/error/loading states, responsive layouts, and deep links.
- [x] Buyers can favorite listings, follow sellers, save searches, and receive relevant notifications.
- [x] Related items and seller inventory are visible without authentication.

### Messaging and negotiation

- [x] Buyer and seller can open a listing-scoped conversation.
- [x] Conversations support text, listing cards, offer cards, system events, unread state, report/block, and retry after send failure. — share listing/offer cards; offer lifecycle and block append system events
- [x] Buyers can make, withdraw, accept, reject, and counter offers. — acceptance creates a pending-payment order; the buyer confirms delivery address before shipping; one unexpired open offer per listing and buyer
- [x] Sellers can send private offers to watchers and second-chance offers to unsold-auction bidders at or below each bidder's proxy maximum.
- [x] Dedicated watcher-only offer listings reject cart/checkout and require `listing.watch` before `offer.create`.
- [x] Offer expiry, currency, quantity, inventory reservation, and optional seller auto-accept thresholds are enforced.
- [x] Duplicate events are idempotent and transitions reject stale revisions.

### Auctions

- [x] Sellers set start price, optional reserve, optional buy-now, bid increment policy, start/end times, and anti-sniping extension.
- [x] Buyers see bid count, current price, reserve status, minimum next bid, end time, their standing, and a public visible-price bid history that never exposes proxy maximums.
- [x] Bids reject closed auctions, seller self-bids, invalid increments, stale revisions, and unaffordable sandbox balances.
- [x] Proxy maximum bidding determines the winner and visible price deterministically.
- [x] Buy-now closes the auction when policy allows it.
- [x] Closing creates one winning order or an unsold result exactly once. — close and buy-now post a pending-payment order and ledger; the winner confirms delivery address before shipping; unpaid expiry reopens the auction as unsold for a second-chance offer to an underbidder

### Cart and checkout

- [x] Fixed-price items can be added, edited, removed, and grouped by seller. — guests use a reserved local cart owner; checkout still requires a real session
- [x] Cart validation refreshes price, stock, delivery availability, and listing state before checkout.
- [x] Checkout captures delivery/contact details without placing raw private data in public records or telemetry.
- [x] Totals itemize subtotal, shipping, discount, tax estimate, and total in one currency per seller order. — sandbox shipping/tax plus SAVE10 cart quote
- [~] Buyers select an eligible Paykit payment endpoint and explicitly confirm order creation. — labeled sandbox endpoint picker; live Bitkit picker unproven
- [x] Duplicate checkout submission reuses the same idempotency key and cannot create duplicate orders/invoices.

### Paykit, Locks, and payment confirmation

- [~] Seller payment setup launches the Paykit Server/Bitkit companion approval flow and reports setup state without exposing wallet secrets. — settings buttons open labeled `/connect` and `/setup` stubs; native `paykit-companion-auth` completed `/setup` with a generated tpub; Bitkit unproven
- [~] Checkout can create a Locks proof lifecycle that causes Locks to request a Paykit invoice. — client hooks + sandbox stub complete empty proofs; native Locks `paykit-payment` proof created one undetected Paykit invoice
- [ ] The real browser flow shows Paykit request/entitlement progress while Bitkit privately receives and executes the payment request; it does not expose or reconstruct the invoice.
- [~] Real buyer-visible status distinguishes awaiting entitlement, confirmed, marketplace-expired, and manual review. — sandbox orders map those four labels; live Bitkit status mapping unproven
- [x] The sandbox adapter may demonstrate invoice QR/deep-link and detailed settlement states only when visibly labeled as simulated.
- [x] Polling is abortable, bounded, resumable after reload, and tolerant of duplicate/reordered responses.
- [x] A confirmed payment advances the order once; later duplicate confirmations are harmless.
- [~] Digital goods use a Locks access credential and verify content hashes. — sandbox issue/refresh/access plus stub credential/content; live Bitkit delivery unproven
- [x] Real payment criteria use direct on-chain Bitcoin with `minimum_confirmations` constrained to `0..6`; Lightning is not claimed by the current Paykit Server adapter.
- [x] Marketplace expiry is an order policy, not a terminal Paykit failure. A late payment enters manual reconciliation because Locks v1 keeps upstream/network failures pending.
- [x] Sandbox mode reproduces all supported statuses deterministically and is visibly labeled.

### Orders and fulfillment

- [x] Buyer and seller order views show a shared timeline with role-appropriate actions.
- [x] Physical orders support address confirmation, handling deadline, shipment, carrier/tracking, delivery, and pickup.
- [x] Digital orders support locked delivery, credential refresh, download/access audit, and content-integrity failure. — sandbox credential on payment confirm; refresh and record_access commands
- [x] Sellers can print a packing summary and a labeled sandbox shipping label, and mark ready/shipped.
- [x] Buyers can confirm receipt; deterministic sandbox delivery can advance automatically.
- [x] Cancellation rules depend on payment and fulfillment state and preserve an immutable event history.

### Returns, refunds, and disputes

- [x] Buyers can request a return with reason, notes, and evidence within policy.
- [x] Sellers can approve, reject, offer partial resolution, or request return shipment.
- [x] Return tracking and inspection lead to full, partial, denied, or externally-refunded outcomes. — `return.ship`, `return.receive`, `return.inspect`, then external refund
- [x] Because Paykit Server cannot spend, real refunds are recorded only after seller-provided external transaction evidence; the app never claims it moved funds.
- [x] Buyers can escalate eligible orders to a dispute.
- [x] Both parties can add evidence; moderators can decide, annotate, and close.
- [x] Every transition is role-checked, time-bounded, idempotent, and auditable.

### Reviews and reputation

- [x] Only completed transactions can produce one buyer review and one seller review per role.
- [x] Rating, text, optional media, item accuracy, shipping, and communication dimensions are supported.
- [x] Reviews can be edited during a bounded window, replied to once, and reported.
- [x] Aggregate ratings update deterministically and exclude removed reviews.

### Seller tools and analytics

- [x] Dashboard shows revenue-equivalent totals, paid orders, conversion, views, favorites, offers, sell-through, and fulfillment health. — `/v1/analytics` plus local order fallbacks
- [x] Inventory supports search, filters, bulk pause/relist/delete, low-stock state, and CSV export/import preview. — pause/activate/delete/duplicate/relist + CSV export/import
- [x] Order work queues expose awaiting payment, to ship, returns, disputes, and completed states.
- [x] Shop settings cover policies, notifications, payment setup, shipping presets, blocked buyers, and vacation mode.
- [x] Promotions support scheduled markdowns and usage-limited seller coupons without producing negative totals.
- [x] Seller statements export orders, fees, taxes, refunds, holds, external payouts, and adjustments and reconcile to the ledger.
- [x] Analytics clearly distinguish local prototype estimates from settled payment facts.

### Tax, shipping, ledger, and guarantees

- [x] A versioned sandbox tax adapter quotes line and shipping tax and blocks checkout when a final quote is unavailable. — `sandbox-us-8pct-v1` + `sandbox-listing-shipping-v1` frozen on the order; pickup defaults to $12, digital $0, listing free/flat/calculated otherwise
- [x] Shipping supports free, flat, and sandbox-calculated rates, idempotent labels, manual fulfillment, normalized tracking, delivery exceptions, pickup, and reverse labels. — listing free/flat/calculated quotes + `sandbox-carrier-table-v1` (US Post matches calculated $14) + normalized tracking + one delivery exception + printable reverse label; live carrier APIs still sandbox
- [x] Every order posts balanced integer-minor-unit ledger entries for items, shipping, tax, discounts, fees, seller receivable, refunds, and adjustments.
- [x] Any unbalanced posting blocks order finalization and creates an operator finding.
- [x] Guarantee eligibility, exclusions, evidence requirements, deadlines, and policy version are shown before purchase and frozen on the order. — `SANDBOX_GUARANTEE_POLICY` on PDP, shop, checkout, and order totals
- [x] Sandbox hold/release and payout states are visibly simulated and blocked by open disputes, returns, risk holds, or unresolved payment status.
- [x] Real Paykit BTC confirmation is never described as escrow, card authorization, marketplace custody, or payout.

### Notifications

- [x] In-app notifications cover listing, favorite/follow, message, offer, bid/outbid/won, payment, shipment, return, dispute, and review events.
- [x] Read/unread, mark-all-read, deep links, deduplication, and per-category preferences work.
- [x] Sensitive order/payment data is not embedded in public notification payloads.

### Trust, safety, and moderation

- [x] Users can report listings, messages, reviews, and accounts with structured reasons and evidence.
- [x] Prohibited-item/category policy warnings are shown during listing creation.
- [x] Moderator queues support assignment, notes, decisions, reversals, and an append-only audit log.
- [x] Restricted listings disappear from discovery but remain visible to authorized parties for disputes.
- [x] Enforcement separates warning, visibility limit, delisting, message limit, transaction hold, suspension, and ban.
- [x] Auction manipulation, account takeover, payment/refund abuse, off-platform scams, and suspicious payout changes create review signals but never silently rewrite transaction history. — increment-only non-leading bids auto-flag `auction_manipulation`
- [x] Rate limits, size limits, URL safety, file validation, and unsafe-state guards have failure tests. — attachment validation + command guards + outbound URL SSRF + CSRF/origin suite + resolved-DNS rebinding (loopback skip, public hostname → private IP rejected)

### Privacy, security, observability, and operations

- [~] Object-level authorization, CSRF/CSP/XSS/SSRF defenses, signed callbacks, replay windows, step-up authorization, least privilege, and upload isolation have adversarial tests. — actor ACL + attachment isolation + commerce URL SSRF + marketplace CSRF/origin + JSON CSP + HMAC Locks payment callbacks (5-minute nonce window) + staff step-up tokens for decide/hold/refund/reconcile; Next.js document CSP is enforced with a per-request nonce on the raw runtime-config script
- [x] Recovery phrases, payment secrets, raw delivery details, message bodies, evidence, access credentials, and private Pubky identifiers never enter analytics, logs, Sentry, or public records.
- [x] Export and deletion flows isolate each account while preserving pseudonymized transaction/audit records required for prototype consistency.
- [x] Health, metrics, redacted traces, dead-letter inspection, idempotent replay, backups, restore drills, migration failure, and rollback have documented verification addresses. — `/health/live`, `/health/ready`, `/v1/metrics`, `/v1/admin/snapshot`; `restore-drill.test.ts` JSON + Postgres file hydrate; ops.md procedure
- [x] Invariant alerts cover oversell, double winner, duplicate payment/refund, unbalanced ledger, stuck fulfillment, and authorization failures.
- [x] Admin searches and manual actions are role-scoped, redacted, reasoned, previewed, and append-only audited. — reserved support/risk/finance/moderator actors; support orders redact street/name/credentials; finance cannot `trust.decide`

### Accessibility, responsiveness, and local-first behavior

- [~] Keyboard navigation, visible focus, semantic labels, dialog focus management, status announcements, and contrast pass automated checks plus manual review. — listing form, catalog filters, guarantee terms, trust indicators, staff chrome, empty cart, shipped-order actions, and confirm-address dialog axe suites; marketplace muted token AA on cards; signed-in manual review still needed
- [~] Core journeys work at 390×844 and desktop widths without hidden actions or horizontal overflow. — responsive templates + catalog VRT; Add to cart / Make offer sit next to quantity above the fold on a 390×844 listing
- [x] Public reads, drafts, social actions, and unsent messages work locally first and show pending/synced/failed status.
- [x] Buy, bid, offer acceptance, payment, refund, release, and payout actions require online server-authoritative confirmation and never claim local-only success.
- [x] Retry queues preserve idempotency and never silently drop a transaction action.
- [x] Sign-out clears private commerce state and adapter credentials for the prior account. — `useCommerceStore.reset()` plus Dexie `clearDatabase()`

## Architecture

### Bounded contexts

```text
UI / hooks
  -> Marketplace controllers
    -> Listing | Discovery | Negotiation | Checkout | Order | Trust applications
      -> local services -> Dexie read models, drafts, safe outbox
      -> homeserver services -> signed Pubky public records
      -> transaction gateway -> Marketplace Transaction Service -> PostgreSQL
      -> entitlement gateway -> Locks -> Paykit Server
```

Rules:

- UI components call form/action hooks; hooks call controllers.
- Controllers normalize intent, update UI stores, and call one application workflow.
- Applications never access Zustand stores and do not call other applications.
- Services own all IndexedDB, homeserver, HTTP, wallet/deep-link, and clock IO.
- Pipes are pure schema/version normalization.
- Cross-domain transaction invariants are implemented atomically by the Marketplace Transaction Service, not Dexie or application-to-application calls.
- Client applications persist server revisions and idempotency keys but never arbitrate winners, stock, settlement, refunds, or ledger state.
- Payment and order state machines use explicit transition tables; UI labels never infer settlement from a generic success response.

### Authority split

| Concern                                            | Authority                                                               | Client behavior                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Public shop/listing/review records                 | Seller-signed Pubky homeserver records; indexed by Nexus when supported | Cache in Dexie and reconcile by version/tombstone        |
| Drafts, carts, saved searches, UI preferences      | Account-scoped Dexie                                                    | Local-first with export and account isolation            |
| Follows, favorites, safe unsent messages           | Pubky records or reviewed encrypted transport                           | Optimistic local state with visible sync status          |
| Inventory reservation, offers, auctions, bids      | Marketplace Transaction Service                                         | Must be online; apply returned server revision           |
| Orders, immutable terms, ledger, returns, disputes | Marketplace Transaction Service                                         | Mirror redacted role-appropriate projections             |
| Payment discovery and private requests             | Paykit                                                                  | Consume through supported service/native bindings        |
| Payment-backed digital entitlement                 | Locks backed by Paykit Server observation                               | Poll verified lifecycle; store bearer material privately |
| Real BTC refund                                    | Seller's external wallet                                                | Record evidence only after independent verification      |

### Marketplace Transaction Service

The existing browser app, homeserver, Nexus, Locks, and Paykit Server cannot provide compare-and-swap inventory, deterministic proxy bidding, an immutable double-entry ledger, or private role-scoped order queries. A separate service is therefore a required prototype component.

It will:

- authenticate Pubky identities without receiving identity secrets;
- expose versioned commands and role-scoped queries for inventory, offers, bids, checkout, orders, fulfillment, returns, disputes, moderation, and the sandbox ledger;
- require an idempotency key and expected aggregate revision for every mutation;
- use PostgreSQL transactions, unique constraints, an append-only event/audit log, and an outbox for side effects;
- use server time for auction close, offer expiry, reservation expiry, claim windows, and payout simulation;
- publish no private order data to Nexus or public homeserver paths;
- integrate with Locks through a narrow adapter and verify payment/entitlement state server-side instead of trusting a client callback;
- expose health, readiness, redacted metrics, reconciliation, and dead-letter replay;
- remain non-custodial and label all holds, releases, payouts, taxes, carriers, and refunds as sandbox facts unless independently verified.

The Next.js API may proxy browser requests and protect deployment secrets, but it is not the durable authority. The service owns its PostgreSQL schema and can run with the requested Pubky Docker topology.

### Data ownership

Public homeserver paths:

```text
/pub/pubky.app/marketplace/v1/shop.json
/pub/pubky.app/marketplace/v1/listings/{listId}.json
/pub/pubky.app/marketplace/v1/reviews/{reviewId}.json
/pub/pubky.app/marketplace/v1/collections/{collectionId}.json
```

Locks-owned paths follow the upstream Locks protocol:

```text
/pub/locks.app/{lockId}.json
/pub/locks.app/config.json
/priv/locks.app/content/{resource}
/priv/locks.app/proofs/{bundleId}.json
```

Private buyer/seller projections are cached in account-scoped Dexie tables. Their authority is the Marketplace Transaction Service or a reviewed encrypted Pubky transport. Networked private messages must use Paykit encrypted links or another reviewed encrypted Pubky protocol before multi-device claims are made. Raw addresses, messages, evidence, access credentials, and payment correlations must never be written to public marketplace paths.

### Local tables

- `commerce_shops`, `commerce_listings`, `commerce_listing_media`, `commerce_inventory`
- `commerce_favorites`, `commerce_saved_searches`, `commerce_conversations`, `commerce_messages`
- `commerce_offers`, `commerce_auctions`, `commerce_bids`, `commerce_carts`
- `commerce_orders`, `commerce_order_events`, `commerce_payments`, `commerce_shipments`
- `commerce_returns`, `commerce_disputes`, `commerce_reviews`, `commerce_reports`
- `commerce_notifications`, `commerce_sync_jobs`, `commerce_audit_events`

These are client read models, drafts, and safe outbox records—not a financial or auction authority. Indexes are derived from actual query plans. Schema changes require a database version change, migration/reset decision, and database tests.

### State machines

- Listing: `draft -> active <-> paused -> reserved -> sold|expired|removed`
- Offer: `pending -> countered|accepted|rejected|withdrawn|expired`
- Auction: `scheduled -> active -> sold|unsold|cancelled`
- Payment: `created -> awaiting -> detected -> confirming -> confirmed|expired|failed|manual_review`
- Order: `pending_payment -> paid -> processing -> shipped|ready_for_pickup -> delivered -> completed`
- Exceptional order branches: `cancel_requested`, `cancelled`, `return_requested`, `return_in_transit`, `return_inspection`, `disputed`, `refunded_external`, `closed`

All events include stable ID, aggregate ID, actor, revision, timestamp, idempotency key, and payload schema version.

### Adapter modes

- `sandbox`: deterministic local adapter for complete demos and failure testing; always labeled.
- `locks-paykit`: vendored Locks JS/WASM viewer against a configured Lock Server. Paykit Server stays out of the browser.
- `unavailable`: fail closed with setup guidance; never silently fall back during a real checkout.

Runtime configuration will include service URLs, adapter mode, polling/backoff limits, confirmation policy, and public keys. Secrets and trusted signing keys stay server-side.

## Task graph

### T0 — Evidence and protocol audit `[x]`

- [x] Inventory existing auth, storage, media, notifications, routes, tests, and design primitives.
- [x] Pin upstream revisions and contracts for Paykit, Paykit Server, Locks, Homeserver, Ring/Bitkit, and Docker.
- [x] Resolve or explicitly replace the unavailable `pubky/design.md` source.
- [x] Produce the acceptance-to-test traceability ledger.

### T1 — Architecture and contracts `[x]`

- [x] Add marketplace ADRs for bounded contexts, public/private protocol, state machines, and adapter trust boundaries.
- [x] Define Zod v4 wire schemas, domain types, IDs, integer money rules, ledger balancing, clocks, revisions, and idempotency.
- [x] Define the Marketplace Transaction Service API, PostgreSQL schema, Pubky authentication, authorization matrix, event log, outbox, reconciliation, and failure semantics.
- [x] Threat-model public records, private delivery data, access credentials, payment status, file uploads, reports, and telemetry.

### T2 — Local-first foundation `[x]`

- [x] Add Dexie schemas/models, database version handling, local services, sync outbox, stores, controllers, and applications.
- [x] Add the transaction service skeleton, PostgreSQL migrations, Pubky auth verifier, health/readiness, event/audit log, and deterministic clock.
- [~] Add deterministic fixtures and sandbox payment, tax, carrier, hold/release, payout, and callback adapters. — catalog + payment advance + flat tax/shipping + HMAC callback + sandbox-carrier-table-v1
- [x] Verify account isolation, recovery, conflict handling, replay, and offline behavior. — command identity + Dexie scoping; JSON/Postgres restore drill

### T3 — Catalog and discovery `[x]`

- [x] Build shop/listing forms, media, variants, inventory, lifecycle actions, marketplace routes, cards, grids, search/filter/sort, recommendations, favorites, follows, and saved searches.
- [x] Add public homeserver write/read adapters and preview-post support.

### T4 — Messaging, offers, and auctions `[x]`

- [x] Build listing-scoped conversations, system events, offers/counters, watcher offers, auction setup, proxy bidding, anti-sniping, close jobs, and notifications. — listing/offer cards + offer system events; watcher-only offer product + `listing.watch`; increment-shill auto-flags
- [x] Verify 100-way concurrent bids and one-unit purchases, stale revisions, expiry, inventory reservation, and idempotent close. — plus 100-way last-unit checkout, last-bid, auction close, and payment confirm

### T5 — Checkout, Paykit, and Locks `[x]`

- [x] Build cart, checkout, totals, private delivery capture, order creation, seller payment setup, invoice presentation, polling, recovery, and status UI.
- [~] Integrate Locks proof/credential APIs and Paykit-backed invoice/status lifecycle. — client adapter; live companion unproven
- [x] Add balanced sandbox ledger postings, tax/shipping quotes, guarantee disclosures, digital delivery, and explicit external-refund evidence. — checkout, auction, buy-now, and accepted-offer orders post balanced integer-minor ledgers

### T6 — Fulfillment and post-purchase `[x]`

- [x] Build order work queues/timelines, shipping presets/tracking, pickup, digital access, cancellations, returns, partial resolutions, disputes, reviews, and reputation.
- [x] Add moderation queues and immutable audit history. — assign, decide, reverse, risk flag, event log

### T7 — Seller operations `[x]`

- [x] Build dashboard, analytics, inventory bulk actions, CSV preview/export, promotions, statements, policies, payment status, vacation mode, notification settings, and blocked-buyer controls.

### T8 — Hardening and parity audit `[~]` `[!]` stopped here

- [~] Run unit, integration, component, VRT, E2E, accessibility, responsive, security, concurrency, migration, offline, retry, restore, reconciliation, and adapter contract suites. — marketplace unit/hook tests, trust/guarantee/payment-status suites, support/finance/risk ACL, HMAC callback + step-up adversarial tests, 100-way concurrency, CSRF/origin/JSON CSP, enforced Next nonce CSP, DNS rebinding, restore drill, catalog VRT mock, thin Cypress browse/auth-gate
- [ ] Compare every acceptance item with authoritative runtime evidence.
- [ ] Fix findings and repeat the complete affected verification scope.

### T9 — Documentation and demonstrations `[ ]`

- [~] Document local sandbox, real Docker topology, runtime configuration, wallet approval, operational limitations, recovery, and threat model. — plan, ADRs, upstream, threat model, service README
- [~] Record buyer, seller, auction, Paykit/Locks, fulfillment, dispute/moderation, and responsive/accessibility videos. — guest catalog plus signed-in checkout/confirm, digital Open/Refresh, operator assign/dismiss, staff consoles, seller dashboard/listing form (not published), trail-runners $80 offer, watcher-only coat $65 offer, unique-open-offer reject plus single boots card, incoming jazz $38 accept to a $54 pending-payment order, and offer-origin address confirm; live Bitkit missing
- [ ] Review every video and retain only successful, minimal demonstrations.

## Verification loop

Each implementation task closes only through this loop:

1. **Address** — map requirement IDs to files, tests, commands, routes, and expected runtime evidence.
2. **Verify** — run the narrowest authoritative checks plus impacted broader gates.
3. **Findings** — record failures, missing coverage, indirect evidence, and upstream limitations.
4. **Fix** — change implementation or tests without weakening the requirement.
5. **Re-verify** — rerun the failed check and all affected integration/E2E paths.
6. **Audit** — independently compare current code and artifacts with every mapped requirement.

Ledger format:

| Requirement                            | Verification address                                   | Expected evidence                       | Finding | Fix                                                                                                 | Re-verification        | Status              |
| -------------------------------------- | ------------------------------------------------------ | --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- | ---------------------- | ------------------- |
| Buy-now closes an auction              | `transaction-service.test.ts` + listing buy-now button | one sold result at buy-now price        | Closed  | Service + UI                                                                                        | Marketplace unit suite | Verified in sandbox |
| Saved searches persist per account     | `useMarketplaceSavedSearches.test.ts` + filters UI     | Dexie row scoped to signed-in pubky     | Closed  | Dexie v6                                                                                            | Hook test              | Verified in sandbox |
| Coupons cannot produce negative totals | checkout + promotion service tests                     | discount <= subtotal, balanced ledger   | Closed  | Integer ledger                                                                                      | Marketplace unit suite | Verified in sandbox |
| Restricted listings leave discovery    | catalog util + moderation decide                       | restricted id omitted from filter       | Closed  | Filter + trust.decide                                                                               | Unit tests             | Verified in sandbox |
| Blocked buyers cannot check out        | `buyer.block` service test                             | checkout UNAUTHORIZED                   | Closed  | Transaction service                                                                                 | Marketplace unit suite | Verified in sandbox |
| Live Bitkit/Paykit companion           | Docker + Bitkit                                        | real invoice observed                   | Open    | Native companion-auth + undetected Paykit invoice                                                   | Invoice row created    | Partial             |
| PostgreSQL durability                  | `postgres-repository.test.ts` + restart                | listing/ledger survive reconnect        | Closed  | Write-through snapshot                                                                              | Marketplace unit suite | Verified in sandbox |
| Snapshot restore drill                 | `restore-drill.test.ts` + `/v1/admin/snapshot`         | JSON hydrate keeps listing/order/ledger | Closed  | export/hydrate + ops.md                                                                             | Marketplace unit suite | Verified in sandbox |
| Next.js document CSP                   | `src/proxy.ts` + runtime-config nonce                  | enforcing CSP, nonce on raw script      | Closed  | Next 16 proxy + ADR 0017                                                                            | CSP unit + curl        | Verified in sandbox |
| Commerce DNS rebinding                 | `safe-resolved-url.test.ts` + instrumentation boot     | public host → private IP rejected       | Closed  | Node `checkDnsSafety`                                                                               | Unit suite             | Verified in sandbox |
| Watcher-only offers                    | `transaction-service.test.ts` + sell form + PDP        | watch required, checkout rejected       | Closed  | Service + catalog                                                                                   | Marketplace unit suite | Verified in sandbox |
| Auction increment-shill auto-flag      | `transaction-service.test.ts`                          | risk signal, bid history unchanged      | Closed  | Auto-flag on `bid.place`                                                                            | Marketplace unit suite | Verified in sandbox |
| Visible bid history                    | `transaction-service.test.ts` + auction PDP            | visible prices only, no proxy max       | Closed  | Projection reconstruct                                                                              | Marketplace unit suite | Verified in sandbox |
| Offer auto-accept                      | `transaction-service.test.ts` + sell form + vase PDP   | threshold reserves inventory            | Closed  | Service + catalog                                                                                   | Marketplace unit suite | Verified in sandbox |
| Feature videos                         | recorded walkthroughs                                  | all feature groups                      | Open    | Guest subset + signed-in checkout, digital clicks, operator moderation, staff consoles, seller form | Live Bitkit missing    | Partial             |
| Vendored Locks JS/WASM                 | `npm run locks:wasm:smoke` + `load-locks-sdk.test.ts`  | pinned `ba49a777` checksums + BundleId  | Closed  | vendor + public asset + client dynamic import                                                       | Smoke + unit           | Verified locally    |
| Support / finance / risk roles         | `transaction-service.test.ts` + `/marketplace/support` | redacted orders; finance cannot decide  | Closed  | Reserved staff pubkys + consoles                                                                    | Marketplace unit suite | Verified in sandbox |
| 100-way checkout / close / payment     | `transaction-service.test.ts`                          | exactly one winner / one confirm        | Closed  | Listing and payment revision CAS                                                                    | Marketplace unit suite | Verified in sandbox |

Required gates:

```text
npm run typecheck
npm run lint
npm run format:check
npm run test -- <changed suites>
npm run test:vrt
npm run build
npm run test:e2e
Locks/Paykit Docker contract smoke tests
Marketplace Transaction Service migrations, concurrency, ledger, replay, and restore tests
manual desktop and 390x844 walkthroughs
```

Full unit and E2E suites run at milestone boundaries and before completion. External staging failures are separated from product defects only with captured evidence; they do not convert an unverified requirement into a pass.

## Delivery slices

Every slice must remain demonstrable:

1. [x] Marketplace shell + sandbox catalog + listing creation.
2. [x] Discovery + favorites/follows + seller shop.
3. [~] Durable transaction service + inventory/ledger foundations.
4. [x] Messaging + offers + concurrency-safe auctions.
5. [x] Cart + checkout + sandbox order/payment lifecycle.
6. [~] Real Locks/Paykit adapter + Bitkit/Ring setup.
7. [x] Fulfillment + returns/refunds/disputes/reviews.
8. [~] Seller analytics + moderation + hardening.
9. [ ] Full parity audit, documentation, and final videos.

No slice may silently remove already visible Pubky functionality or reduce existing feed/profile behavior.
