import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { applyMarketplaceSchema, PostgresMarketplaceRepository } from './postgres-repository';
import { buildMarketplaceListingAggregateId } from './contracts';
import { MarketplaceTransactionService } from './transaction-service';

const DATABASE_URL =
  process.env.MARKETPLACE_TEST_DATABASE_URL ?? 'postgres://marketplace:marketplace@127.0.0.1:5432/marketplace_test';
const SELLER = 'y'.repeat(52);
const NOW = new Date('2026-08-20T10:00:00.000Z');

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

describe.skipIf(!available)('Postgres marketplace repository', () => {
  beforeEach(async () => {
    const pool = new Pool({ connectionString: DATABASE_URL });
    await applyMarketplaceSchema(pool);
    await pool.query(
      `TRUNCATE marketplace_outbox, marketplace_events, marketplace_ledger_entries, marketplace_aggregates, marketplace_commands, marketplace_snapshots RESTART IDENTITY CASCADE`,
    );
    await pool.end();
  });

  afterAll(async () => {
    const pool = new Pool({ connectionString: DATABASE_URL });
    await pool.end().catch(() => undefined);
  });

  it('survives a process restart with listings, orders, and a balanced ledger', async () => {
    const first = await PostgresMarketplaceRepository.connect(DATABASE_URL);
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
    await first.close();

    const second = await PostgresMarketplaceRepository.connect(DATABASE_URL);
    const secondService = new MarketplaceTransactionService(second, () => NOW);
    const listing = secondService.getListingProjection(buildMarketplaceListingAggregateId(SELLER, 'boots_01'));
    expect(listing).toMatchObject({ availableQuantity: 2, serverRevision: 1 });
    expect(secondService.getInvariants().unbalancedOrders).toEqual([]);
    await second.close();
  });
});
