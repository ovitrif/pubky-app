import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  buildMarketplaceCheckoutAggregateId,
  buildMarketplaceListingAggregateId,
  buildMarketplacePaymentAggregateId,
} from './contracts';
import { MARKETPLACE_TEST_DATABASE_URL, withExclusiveMarketplaceTestDb } from './marketplace-test-db';
import { PostgresMarketplaceRepository } from './postgres-repository';
import {
  InMemoryMarketplaceRepository,
  type MarketplaceRepositorySnapshot,
  MarketplaceTransactionService,
} from './transaction-service';

const SELLER = 'y'.repeat(52);
const BUYER = 'b'.repeat(52);
const NOW = new Date('2026-08-20T10:00:00.000Z');
const DATABASE_URL = MARKETPLACE_TEST_DATABASE_URL;

async function seedPaidOrder(repository: InMemoryMarketplaceRepository): Promise<string> {
  const service = new MarketplaceTransactionService(repository, () => NOW);
  const listingAggregateId = buildMarketplaceListingAggregateId(SELLER, 'restore_boots');
  const register = await service.execute(SELLER, {
    version: 1,
    commandId: '018f47d2-6a27-7c23-a49d-6b21bb770401',
    aggregateId: listingAggregateId,
    expectedRevision: 0,
    issuedAt: NOW.toISOString(),
    kind: 'listing.register',
    payload: {
      sellerPubky: SELLER,
      listingId: 'restore_boots',
      listingRevision: 1,
      contentHash: 'b'.repeat(64),
      quantity: 2,
      unitPrice: { amountMinor: 12_500, currency: 'USD', exponent: 2 },
    },
  });
  if (!register.ok) throw new Error('register failed');

  const checkoutId = '018f47d2-6a27-7c23-a49d-6b21bb770402';
  const checkout = await service.execute(BUYER, {
    version: 1,
    commandId: checkoutId,
    aggregateId: buildMarketplaceCheckoutAggregateId(checkoutId),
    expectedRevision: 0,
    issuedAt: NOW.toISOString(),
    kind: 'checkout.create',
    payload: {
      lines: [{ listingAggregateId, expectedRevision: 1, quantity: 1 }],
      deliveryAddress: {
        name: 'Restore Buyer',
        line1: '1 Market Street',
        line2: '',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        countryCode: 'US',
      },
      guaranteePolicyVersion: 1,
    },
  });
  if (!checkout.ok || checkout.result.kind !== 'checkout') throw new Error('checkout failed');
  const payment = checkout.result.payments[0];
  const confirmed = await service.execute(BUYER, {
    version: 1,
    commandId: '018f47d2-6a27-7c23-a49d-6b21bb770403',
    aggregateId: buildMarketplacePaymentAggregateId(payment.id),
    expectedRevision: payment.revision,
    issuedAt: NOW.toISOString(),
    kind: 'payment.sandbox_advance',
    payload: { paymentId: payment.id, target: 'confirmed', confirmations: 1 },
  });
  if (!confirmed.ok) throw new Error('payment confirm failed');
  return checkout.result.orders[0].id;
}

function expectRestoredPaidOrder(service: MarketplaceTransactionService, orderId: string): void {
  expect(service.getListingProjection(buildMarketplaceListingAggregateId(SELLER, 'restore_boots'))).toMatchObject({
    availableQuantity: 1,
    reservedQuantity: 0,
    soldQuantity: 1,
  });
  const orders = service.getOrders(BUYER);
  expect(orders[0]).toMatchObject({
    id: orderId,
    state: 'paid',
    inventoryState: 'sold',
    deliveryAddress: {
      name: 'Restore Buyer',
      line1: '1 Market Street',
      city: 'New York',
    },
  });
  const ledger = service.getLedger(BUYER, orderId);
  const debit = ledger
    .filter(({ direction }) => direction === 'debit')
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const credit = ledger
    .filter(({ direction }) => direction === 'credit')
    .reduce((total, entry) => total + entry.amountMinor, 0);
  expect(debit).toBe(credit);
  expect(debit).toBeGreaterThan(0);
  expect(service.getInvariants().unbalancedOrders).toEqual([]);
}

describe('marketplace restore drill', () => {
  it('restores listings, orders, and a balanced ledger from a JSON snapshot', async () => {
    const source = new InMemoryMarketplaceRepository();
    const orderId = await seedPaidOrder(source);
    const json = JSON.stringify(source.exportSnapshot());
    const restored = new InMemoryMarketplaceRepository();
    restored.hydrateSnapshot(JSON.parse(json) as MarketplaceRepositorySnapshot);
    expectRestoredPaidOrder(new MarketplaceTransactionService(restored, () => NOW), orderId);
  });
});

async function postgresAvailable(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 1_000 });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

const available = await postgresAvailable();

describe.skipIf(!available)('marketplace PostgreSQL restore drill', () => {
  it('rehydrates a file snapshot into a fresh database', async () => {
    await withExclusiveMarketplaceTestDb(async () => {
      const first = await PostgresMarketplaceRepository.connect(DATABASE_URL);
      const orderId = await seedPaidOrder(first);
      const snapshot = first.exportSnapshot();
      const snapshotPath = path.join(tmpdir(), `marketplace-restore-${Date.now()}.json`);
      await writeFile(snapshotPath, JSON.stringify(snapshot), 'utf8');
      await first.close();

      const reset = new Pool({ connectionString: DATABASE_URL });
      await reset.query(
        `TRUNCATE marketplace_outbox, marketplace_events, marketplace_ledger_entries, marketplace_aggregates, marketplace_commands, marketplace_snapshots RESTART IDENTITY CASCADE`,
      );
      await reset.query(
        `INSERT INTO marketplace_snapshots (id, payload, updated_at) VALUES ('default', $1::jsonb, now())`,
        [JSON.stringify(snapshot)],
      );
      await reset.end();

      const second = await PostgresMarketplaceRepository.connect(DATABASE_URL);
      expectRestoredPaidOrder(new MarketplaceTransactionService(second, () => NOW), orderId);
      await second.close();
    });
  });
});
