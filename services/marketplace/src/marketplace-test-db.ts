import { Pool } from 'pg';
import { applyMarketplaceSchema } from './postgres-repository';

const MARKETPLACE_TEST_LOCK = 87_451_203;

export const MARKETPLACE_TEST_DATABASE_URL =
  process.env.MARKETPLACE_TEST_DATABASE_URL ?? 'postgres://marketplace:marketplace@127.0.0.1:5432/marketplace_test';

export async function withExclusiveMarketplaceTestDb<T>(run: () => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: MARKETPLACE_TEST_DATABASE_URL, max: 2 });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MARKETPLACE_TEST_LOCK]);
    await applyMarketplaceSchema(pool);
    await pool.query(
      `TRUNCATE marketplace_outbox, marketplace_events, marketplace_ledger_entries, marketplace_aggregates, marketplace_commands, marketplace_snapshots RESTART IDENTITY CASCADE`,
    );
    return await run();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MARKETPLACE_TEST_LOCK]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}
