import type { AddressInfo } from 'node:net';
import { fetch as realFetch } from 'undici';
import { describe, expect, it } from 'vitest';
import { MARKETPLACE_CSRF_HEADER, MARKETPLACE_CSRF_TOKEN } from '../../../src/libs/commerce/marketplace-http-security';
import {
  MARKETPLACE_SANDBOX_CALLBACK_SECRET,
  marketplaceCallbackHeaders,
} from '../../../src/libs/commerce/signed-callback';
import { MARKETPLACE_STEP_UP_HEADER } from '../../../src/libs/commerce/step-up';
import { buildMarketplaceCheckoutAggregateId, buildMarketplaceListingAggregateId } from './contracts';
import { createMarketplaceHttpServer, type MarketplaceServerMode } from './server';
import { MARKETPLACE_SANDBOX_FINANCE, MARKETPLACE_SANDBOX_MODERATOR } from './transaction-service';

function commandHeaders(extra: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-pubky-actor': SELLER,
    [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
    ...extra,
  };
}

const SELLER = 'y'.repeat(52);
const BUYER = 'b'.repeat(52);
const CALLBACK_NOW = new Date('2026-08-20T22:00:00.000Z');

async function withServer<T>(mode: MarketplaceServerMode, operation: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createMarketplaceHttpServer({ mode });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;

  try {
    return await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function registrationCommand() {
  return {
    version: 1,
    commandId: '018f47d2-6a27-7c23-a49d-6b21bb770120',
    aggregateId: buildMarketplaceListingAggregateId(SELLER, 'boots_01'),
    expectedRevision: 0,
    issuedAt: '2026-08-19T22:00:00.000Z',
    kind: 'listing.register',
    payload: {
      sellerPubky: SELLER,
      listingId: 'boots_01',
      listingRevision: 1,
      contentHash: 'a'.repeat(64),
      quantity: 1,
      unitPrice: { amountMinor: 12_500, currency: 'USD', exponent: 2 },
    },
  };
}

describe('marketplace HTTP server', () => {
  it('reports liveness while disabled but fails readiness closed', async () => {
    await withServer('disabled', async (baseUrl) => {
      const live = await realFetch(`${baseUrl}/health/live`);
      const ready = await realFetch(`${baseUrl}/health/ready`);

      expect(live.status).toBe(200);
      expect(await live.json()).toEqual({ status: 'live' });
      expect(ready.status).toBe(503);
      expect(await ready.json()).toEqual({ status: 'not_ready', mode: 'disabled', storage: 'memory' });
    });
  });

  it('rejects commands when sandbox mode was not explicit', async () => {
    await withServer('disabled', async (baseUrl) => {
      const response = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        body: JSON.stringify(registrationCommand()),
      });

      expect(response.status).toBe(503);
      expect(response.headers.get('x-marketplace-mode')).toBe('disabled');
    });
  });

  it('requires an explicit sandbox actor and labels every response', async () => {
    await withServer('sandbox', async (baseUrl) => {
      const missingActor = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
        },
        body: JSON.stringify(registrationCommand()),
      });
      expect(missingActor.status).toBe(401);

      const accepted = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders(),
        body: JSON.stringify(registrationCommand()),
      });

      expect(accepted.status).toBe(200);
      expect(accepted.headers.get('x-marketplace-mode')).toBe('sandbox');
      expect(accepted.headers.get('access-control-allow-origin')).toBe('*');
      expect(accepted.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(accepted.headers.get('x-content-type-options')).toBe('nosniff');
      await expect(accepted.json()).resolves.toMatchObject({ ok: true, revision: 1 });

      const listing = await realFetch(
        `${baseUrl}/v1/listings?aggregateId=${encodeURIComponent(registrationCommand().aggregateId)}`,
      );
      expect(listing.status).toBe(200);
      await expect(listing.json()).resolves.toMatchObject({ serverRevision: 1, saleFormat: 'fixed_price' });
    });
  });

  it('answers sandbox CORS preflight without enabling disabled commands', async () => {
    await withServer('sandbox', async (baseUrl) => {
      const response = await realFetch(`${baseUrl}/v1/commands`, { method: 'OPTIONS' });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });
  });

  it('uploads and participant-authorizes private image attachments', async () => {
    await withServer('sandbox', async (baseUrl) => {
      const recipient = 'b'.repeat(52);
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02]);
      const upload = await realFetch(`${baseUrl}/v1/attachments`, {
        method: 'POST',
        headers: {
          'content-type': 'image/jpeg',
          'x-pubky-actor': SELLER,
          'x-recipient-pubky': recipient,
          [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
        },
        body: bytes,
      });
      expect(upload.status).toBe(201);
      const metadata = (await upload.json()) as { id: string; contentHash: string };
      expect(metadata.contentHash).toMatch(/^[a-f0-9]{64}$/);

      const download = await realFetch(`${baseUrl}/v1/attachments/${metadata.id}`, {
        headers: { 'x-pubky-actor': recipient },
      });
      expect(download.status).toBe(200);
      expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);

      const unrelated = await realFetch(`${baseUrl}/v1/attachments/${metadata.id}`, {
        headers: { 'x-pubky-actor': 'n'.repeat(52) },
      });
      expect(unrelated.status).toBe(404);
    });
  });

  it('returns a coarse error for malformed JSON without echoing the body', async () => {
    await withServer('sandbox', async (baseUrl) => {
      const response = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders(),
        body: '{"private":"secret"',
      });

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain('INVALID_JSON');
      expect(body).not.toContain('secret');
    });
  });

  it('rejects sandbox mutations without the CSRF header or from a disallowed origin', async () => {
    await withServer('sandbox', async (baseUrl) => {
      const missingCsrf = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pubky-actor': SELLER,
        },
        body: JSON.stringify(registrationCommand()),
      });
      expect(missingCsrf.status).toBe(403);
      expect(await missingCsrf.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    const server = createMarketplaceHttpServer({ mode: 'sandbox', allowedOrigin: 'http://localhost:3000' });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const blocked = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({ origin: 'https://evil.test' }),
        body: JSON.stringify(registrationCommand()),
      });
      expect(blocked.status).toBe(403);

      const allowed = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({ origin: 'http://localhost:3000' }),
        body: JSON.stringify(registrationCommand()),
      });
      expect(allowed.status).toBe(200);

      const metrics = await realFetch(`${baseUrl}/v1/metrics`);
      expect(metrics.status).toBe(200);
      await expect(metrics.json()).resolves.toMatchObject({
        listings: 1,
        orders: 0,
        reservedOnPaidOrders: 0,
      });

      const forbiddenSnapshot = await realFetch(`${baseUrl}/v1/admin/snapshot`, {
        headers: { 'x-pubky-actor': SELLER },
      });
      expect(forbiddenSnapshot.status).toBe(403);

      const snapshot = await realFetch(`${baseUrl}/v1/admin/snapshot`, {
        headers: { 'x-pubky-actor': MARKETPLACE_SANDBOX_MODERATOR },
      });
      expect(snapshot.status).toBe(200);
      await expect(snapshot.json()).resolves.toMatchObject({
        listings: [{ listingId: 'boots_01' }],
        orders: [],
        ledger: [],
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('requires a purpose-bound step-up token for privileged staff commands', async () => {
    await withServer('sandbox', async (baseUrl) => {
      const command = {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001920',
        aggregateId: 'inventory:reconcile',
        expectedRevision: 0,
        issuedAt: CALLBACK_NOW.toISOString(),
        kind: 'inventory.reconcile_paid',
        payload: {},
      };
      const missing = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({ 'x-pubky-actor': MARKETPLACE_SANDBOX_FINANCE }),
        body: JSON.stringify(command),
      });
      expect(missing.status).toBe(403);
      expect(await missing.json()).toMatchObject({
        error: { code: 'UNAUTHORIZED', message: 'A marketplace step-up token is required.' },
      });

      const issued = await realFetch(`${baseUrl}/v1/auth/step-up`, {
        method: 'POST',
        headers: commandHeaders({ 'x-pubky-actor': MARKETPLACE_SANDBOX_FINANCE }),
        body: JSON.stringify({ purpose: 'finance' }),
      });
      expect(issued.status).toBe(200);
      const tokenBody = (await issued.json()) as { token: string; purpose: string };
      expect(tokenBody.purpose).toBe('finance');

      const wrongPurpose = await realFetch(`${baseUrl}/v1/auth/step-up`, {
        method: 'POST',
        headers: commandHeaders({ 'x-pubky-actor': MARKETPLACE_SANDBOX_FINANCE }),
        body: JSON.stringify({ purpose: 'risk' }),
      });
      const riskToken = (await wrongPurpose.json()) as { token: string };
      const rejected = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({
          'x-pubky-actor': MARKETPLACE_SANDBOX_FINANCE,
          [MARKETPLACE_STEP_UP_HEADER]: riskToken.token,
        }),
        body: JSON.stringify(command),
      });
      expect(rejected.status).toBe(403);

      const accepted = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({
          'x-pubky-actor': MARKETPLACE_SANDBOX_FINANCE,
          [MARKETPLACE_STEP_UP_HEADER]: tokenBody.token,
        }),
        body: JSON.stringify(command),
      });
      expect(accepted.status).toBe(200);
      await expect(accepted.json()).resolves.toMatchObject({ ok: true, result: { kind: 'inventory_reconcile' } });
    });
  });

  it('accepts HMAC-signed Locks payment callbacks and rejects unsigned or replayed ones', async () => {
    const server = createMarketplaceHttpServer({
      mode: 'sandbox',
      now: () => CALLBACK_NOW,
      allowedOrigin: 'http://localhost:3000',
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({ origin: 'http://localhost:3000' }),
        body: JSON.stringify(registrationCommand()),
      });
      const checkoutId = '00000000-0000-4000-8000-000000001930';
      const checkout = await realFetch(`${baseUrl}/v1/commands`, {
        method: 'POST',
        headers: commandHeaders({ origin: 'http://localhost:3000', 'x-pubky-actor': BUYER }),
        body: JSON.stringify({
          version: 1,
          commandId: checkoutId,
          aggregateId: buildMarketplaceCheckoutAggregateId(checkoutId),
          expectedRevision: 0,
          issuedAt: CALLBACK_NOW.toISOString(),
          kind: 'checkout.create',
          payload: {
            lines: [{ listingAggregateId: registrationCommand().aggregateId, expectedRevision: 1, quantity: 1 }],
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
        }),
      });
      expect(checkout.status).toBe(200);
      const checkoutBody = (await checkout.json()) as {
        ok: boolean;
        result: { payments: Array<{ id: string }> };
      };
      const paymentId = checkoutBody.result.payments[0]?.id;
      expect(paymentId).toMatch(/^[0-9a-f-]{36}$/);

      const payload = {
        version: 1 as const,
        paymentId,
        target: 'confirmed' as const,
        confirmations: 1,
        commandId: '00000000-0000-4000-8000-000000001931',
      };
      const rawBody = JSON.stringify(payload);
      const nonce = 'ab'.repeat(16);
      const headers = marketplaceCallbackHeaders({
        secret: MARKETPLACE_SANDBOX_CALLBACK_SECRET,
        timestampMs: CALLBACK_NOW.getTime(),
        nonce,
        rawBody,
      });

      const unsigned = await realFetch(`${baseUrl}/v1/callbacks/locks-payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: rawBody,
      });
      expect(unsigned.status).toBe(401);

      const confirmed = await realFetch(`${baseUrl}/v1/callbacks/locks-payment`, {
        method: 'POST',
        headers,
        body: rawBody,
      });
      expect(confirmed.status).toBe(200);
      await expect(confirmed.json()).resolves.toMatchObject({
        ok: true,
        result: { kind: 'payment', payment: { state: 'confirmed' } },
      });

      const replayed = await realFetch(`${baseUrl}/v1/callbacks/locks-payment`, {
        method: 'POST',
        headers,
        body: rawBody,
      });
      expect(replayed.status).toBe(409);
      await expect(replayed.json()).resolves.toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
