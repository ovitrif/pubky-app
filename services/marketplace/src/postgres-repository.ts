import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import {
  InMemoryMarketplaceRepository,
  type MarketplaceEvent,
  type MarketplaceLedgerEntry,
  type MarketplaceRepositorySnapshot,
} from './transaction-service';

const SCHEMA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../schema.sql');

export async function applyMarketplaceSchema(pool: Pool): Promise<void> {
  const sql = await readFile(SCHEMA_PATH, 'utf8');
  await pool.query(sql);
}

export async function createMarketplacePool(connectionString: string): Promise<Pool> {
  const pool = new Pool({ connectionString, max: 8 });
  await applyMarketplaceSchema(pool);
  return pool;
}

export class PostgresMarketplaceRepository extends InMemoryMarketplaceRepository {
  private constructor(private readonly pool: Pool) {
    super();
  }

  static async connect(connectionString: string): Promise<PostgresMarketplaceRepository> {
    const pool = await createMarketplacePool(connectionString);
    const repository = new PostgresMarketplaceRepository(pool);
    await repository.load();
    return repository;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  override async transaction<T>(operation: () => T | Promise<T>): Promise<T> {
    return super.transaction(async () => {
      const previous = this.exportSnapshot();
      try {
        const result = await operation();
        await this.save();
        return result;
      } catch (error) {
        this.hydrateSnapshot(previous);
        throw error;
      }
    });
  }

  private async load(): Promise<void> {
    const snapshot = await this.pool.query<{ payload: MarketplaceRepositorySnapshot }>(
      'SELECT payload FROM marketplace_snapshots WHERE id = $1',
      ['default'],
    );
    if (snapshot.rows[0]) {
      this.hydrateSnapshot(snapshot.rows[0].payload);
    }
  }

  private async save(): Promise<void> {
    const snapshot = this.exportSnapshot();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO marketplace_snapshots (id, payload, updated_at)
         VALUES ('default', $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
        [JSON.stringify(snapshot)],
      );
      await persistEvents(client, snapshot.events);
      await persistLedger(client, snapshot.ledger);
      await persistCommands(client, snapshot.commands);
      await persistAggregates(client, snapshot);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function persistEvents(client: PoolClient, events: MarketplaceEvent[]): Promise<void> {
  for (const event of events) {
    await query(
      client,
      `INSERT INTO marketplace_events (
         event_id, aggregate_id, actor_pubky, command_id, kind, revision, payload, occurred_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.id,
        event.aggregateId,
        event.actorPubky,
        event.commandId,
        event.kind,
        event.revision,
        JSON.stringify(event),
        event.occurredAt,
      ],
    );
    await query(
      client,
      `INSERT INTO marketplace_outbox (outbox_id, event_id, destination, next_attempt_at)
       VALUES ($1, $2, 'projection', now())
       ON CONFLICT (outbox_id) DO NOTHING`,
      [event.id, event.id],
    );
  }
}

async function persistLedger(client: PoolClient, entries: MarketplaceLedgerEntry[]): Promise<void> {
  for (const entry of entries) {
    await query(
      client,
      `INSERT INTO marketplace_ledger_entries (
         entry_id, order_id, account, direction, amount_minor, currency, exponent, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (entry_id) DO NOTHING`,
      [
        entry.id,
        entry.orderId,
        entry.account,
        entry.direction,
        entry.amountMinor,
        entry.currency,
        entry.exponent,
        entry.createdAt,
      ],
    );
  }
}

async function persistCommands(client: PoolClient, commands: MarketplaceRepositorySnapshot['commands']): Promise<void> {
  for (const command of commands) {
    const [actorPubky, commandId] = command.key.split(':');
    if (!actorPubky || !commandId) continue;
    await query(
      client,
      `INSERT INTO marketplace_commands (actor_pubky, command_id, request_hash, result)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (actor_pubky, command_id) DO UPDATE
       SET request_hash = EXCLUDED.request_hash, result = EXCLUDED.result`,
      [actorPubky, commandId, command.stored.requestHash, JSON.stringify(command.stored.result)],
    );
  }
}

async function persistAggregates(client: PoolClient, snapshot: MarketplaceRepositorySnapshot): Promise<void> {
  const rows = [
    ...snapshot.listings.map((listing) => ({
      aggregateId: listing.aggregateId,
      kind: 'listing',
      revision: listing.serverRevision,
      sellerPubky: listing.sellerPubky,
      buyerPubky: null,
      payload: listing,
      updatedAt: listing.updatedAt,
    })),
    ...snapshot.orders.map((order) => ({
      aggregateId: `order:${order.id}`,
      kind: 'order',
      revision: order.revision,
      sellerPubky: order.sellerPubky,
      buyerPubky: order.buyerPubky,
      payload: { ...order, deliveryAddress: undefined },
      updatedAt: order.updatedAt,
    })),
    ...snapshot.payments.map((payment) => ({
      aggregateId: `payment:${payment.id}`,
      kind: 'payment',
      revision: payment.revision,
      sellerPubky: payment.sellerPubky,
      buyerPubky: payment.buyerPubky,
      payload: payment,
      updatedAt: payment.updatedAt,
    })),
  ];

  for (const row of rows) {
    await query(
      client,
      `INSERT INTO marketplace_aggregates (
         aggregate_id, kind, revision, seller_pubky, buyer_pubky, payload, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (aggregate_id) DO UPDATE SET
         revision = EXCLUDED.revision,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [
        row.aggregateId,
        row.kind,
        row.revision,
        row.sellerPubky,
        row.buyerPubky,
        JSON.stringify(row.payload),
        row.updatedAt,
      ],
    );
  }
}

async function query<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[],
): Promise<QueryResult<T>> {
  return client.query<T>(sql, values);
}
