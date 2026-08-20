import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  buildMarketplaceCheckoutAggregateId,
  buildMarketplaceListingAggregateId,
  buildMarketplacePaymentAggregateId,
} from './contracts';
import { MARKETPLACE_TEST_DATABASE_URL, withExclusiveMarketplaceTestDb } from './marketplace-test-db';
import { PostgresMarketplaceRepository } from './postgres-repository';
import { MarketplaceTransactionService } from './transaction-service';

const SELLER = 'y'.repeat(52);
const BUYER = 'b'.repeat(52);
const NOW = new Date('2026-08-20T10:00:00.000Z');

async function postgresAvailable(): Promise<boolean> {
  const pool = new Pool({ connectionString: MARKETPLACE_TEST_DATABASE_URL, connectionTimeoutMillis: 1_000 });
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

describe.skipIf(!available)('Postgres marketplace repository', () => {
  it('survives a process restart with listings, orders, and a balanced ledger', async () => {
    await withExclusiveMarketplaceTestDb(async () => {
      const first = await PostgresMarketplaceRepository.connect(MARKETPLACE_TEST_DATABASE_URL);
      const firstService = new MarketplaceTransactionService(first, () => NOW);
      const register = await firstService.execute(SELLER, {
        version: 1,
        commandId: '018f47d2-6a27-7c23-a49d-6b21bb770220',
        aggregateId: buildMarketplaceListingAggregateId(SELLER, 'boots_01'),
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'listing.register',
        payload: {
          sellerPubky: SELLER,
          listingId: 'boots_01',
          listingRevision: 1,
          contentHash: 'a'.repeat(64),
          quantity: 2,
          unitPrice: { amountMinor: 12_500, currency: 'USD', exponent: 2 },
        },
      });
      expect(register).toMatchObject({ ok: true, revision: 1 });

      const checkoutId = '018f47d2-6a27-7c23-a49d-6b21bb770221';
      const checkout = await firstService.execute(BUYER, {
        version: 1,
        commandId: checkoutId,
        aggregateId: buildMarketplaceCheckoutAggregateId(checkoutId),
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'checkout.create',
        payload: {
          lines: [
            {
              listingAggregateId: buildMarketplaceListingAggregateId(SELLER, 'boots_01'),
              expectedRevision: 1,
              quantity: 1,
            },
          ],
          deliveryAddress: {
            name: 'Alice Buyer',
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
      expect(checkout).toMatchObject({ ok: true });
      if (!checkout.ok || checkout.result.kind !== 'checkout') throw new Error('checkout failed');
      const payment = checkout.result.payments[0];
      const confirmed = await firstService.execute(BUYER, {
        version: 1,
        commandId: '018f47d2-6a27-7c23-a49d-6b21bb770222',
        aggregateId: buildMarketplacePaymentAggregateId(payment.id),
        expectedRevision: payment.revision,
        issuedAt: NOW.toISOString(),
        kind: 'payment.sandbox_advance',
        payload: { paymentId: payment.id, target: 'confirmed', confirmations: 1 },
      });
      expect(confirmed).toMatchObject({ ok: true, result: { payment: { state: 'confirmed' } } });
      await first.close();

      const second = await PostgresMarketplaceRepository.connect(MARKETPLACE_TEST_DATABASE_URL);
      const secondService = new MarketplaceTransactionService(second, () => NOW);
      const listing = secondService.getListingProjection(buildMarketplaceListingAggregateId(SELLER, 'boots_01'));
      expect(listing).toMatchObject({
        availableQuantity: 1,
        reservedQuantity: 0,
        soldQuantity: 1,
        viewCount: 0,
        watcherCount: 0,
      });
      const orders = secondService.getOrders(BUYER);
      expect(orders[0]).toMatchObject({
        state: 'paid',
        inventoryState: 'sold',
        deliveryAddress: {
          name: 'Alice Buyer',
          line1: '1 Market Street',
          city: 'New York',
          region: 'NY',
          postalCode: '10001',
          countryCode: 'US',
        },
      });
      const inspect = new Pool({ connectionString: MARKETPLACE_TEST_DATABASE_URL });
      const aggregates = await inspect.query<{ payload: { deliveryAddress?: unknown } }>(
        `SELECT payload FROM marketplace_aggregates WHERE kind = 'order'`,
      );
      await inspect.end();
      expect(aggregates.rows[0]?.payload.deliveryAddress).toBeUndefined();
      expect(JSON.stringify(aggregates.rows[0]?.payload)).not.toContain('Alice Buyer');
      expect(JSON.stringify(aggregates.rows[0]?.payload)).not.toContain('1 Market Street');
      const ledger = secondService.getLedger(BUYER, orders[0]?.id);
      const debit = ledger
        .filter(({ direction }) => direction === 'debit')
        .reduce((total, entry) => total + entry.amountMinor, 0);
      const credit = ledger
        .filter(({ direction }) => direction === 'credit')
        .reduce((total, entry) => total + entry.amountMinor, 0);
      expect(debit).toBe(credit);
      expect(debit).toBeGreaterThan(0);
      expect(secondService.getInvariants().unbalancedOrders).toEqual([]);
      await second.close();
    });
  });
});
