import type { AddressInfo } from 'node:net';
import { fetch as realFetch } from 'undici';
import { describe, expect, it } from 'vitest';
import {
  createLocksSandboxHttpServer,
  createLocksSandboxStore,
  createPaykitSetupSandboxHttpServer,
} from './server';

const CREATOR = 'k'.repeat(52);
const READER = 'b'.repeat(52);
const BUNDLE_ID = '000G40R40M30E209185GR38E1W';

async function withLocksServer<T>(
  operation: (baseUrl: string) => Promise<T>,
  store = createLocksSandboxStore(),
): Promise<T> {
  const server = createLocksSandboxHttpServer({ store });
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

function proofBody(overrides: Record<string, unknown> = {}) {
  return {
    submitted_proof_bundle: {
      version: 1,
      bundle_id: BUNDLE_ID,
      pubky_lock_resource: `pubky${CREATOR}/pub/locks.app/pattern_pack.json`,
      reader_public_key: `pubky${READER}`,
      proofs: [{ criterion_id: 'criterion-1', verifier_type: 'paykit-payment', payload: {} }],
      ...overrides,
    },
  };
}

describe('locks sandbox HTTP stub', () => {
  it('labels readiness and rejects invoice-bearing Paykit payloads', async () => {
    await withLocksServer(async (baseUrl) => {
      const ready = await realFetch(`${baseUrl}/health/ready`);
      expect(ready.status).toBe(200);
      expect(ready.headers.get('x-locks-mode')).toBe('sandbox');
      expect(await ready.json()).toEqual({ status: 'ready', mode: 'sandbox', role: 'locks-http-stub' });

      const rejected = await realFetch(`${baseUrl}/proof-bundles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          proofBody({
            proofs: [
              {
                criterion_id: 'criterion-1',
                verifier_type: 'paykit-payment',
                payload: { invoice: 'bitcoin:tb1qexample' },
              },
            ],
          }),
        ),
      });
      expect(rejected.status).toBe(400);
      await expect(rejected.json()).resolves.toMatchObject({
        error: { code: 'INVALID_PROOF' },
      });
    });
  });

  it('completes an empty Paykit proof and issues a sandbox credential for guarded content', async () => {
    await withLocksServer(async (baseUrl) => {
      const submitted = await realFetch(`${baseUrl}/proof-bundles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(proofBody()),
      });
      expect(submitted.status).toBe(200);
      await expect(submitted.json()).resolves.toMatchObject({
        creator: `pubky${CREATOR}`,
        bundle_id: BUNDLE_ID,
        status: 'pending',
      });

      const lookup = await realFetch(`${baseUrl}/verification-task-lookups`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator: `pubky${CREATOR}`, bundle_id: BUNDLE_ID }),
      });
      expect(lookup.status).toBe(200);
      await expect(lookup.json()).resolves.toMatchObject({ status: 'completed', failure_message: null });

      const issued = await realFetch(`${baseUrl}/access-credentials`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator: `pubky${CREATOR}`, bundle_id: BUNDLE_ID }),
      });
      const credential = (await issued.json()) as { credential: string; expires_at: string };
      expect(issued.status).toBe(200);
      expect(credential.credential.startsWith('sandbox-locks-')).toBe(true);

      const denied = await realFetch(`${baseUrl}/priv-resources/content/orders/pattern_pack.json`);
      expect(denied.status).toBe(401);

      const content = await realFetch(`${baseUrl}/priv-resources/content/orders/pattern%20pack.json`, {
        headers: { authorization: `Bearer ${credential.credential}` },
      });
      expect(content.status).toBe(200);
      await expect(content.json()).resolves.toMatchObject({
        mode: 'sandbox',
        path: 'orders/pattern pack.json',
        notice: expect.stringContaining('not a live Bitkit'),
      });
    });
  });

  it('labels connect HTML as a Ring-less sandbox stub', async () => {
    await withLocksServer(async (baseUrl) => {
      const response = await realFetch(
        `${baseUrl}/connect?return_to=http://localhost:3000/marketplace/settings&state=opaque-state`,
      );
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get('x-locks-mode')).toBe('sandbox');
      expect(html).toContain('SANDBOX');
      expect(html).toContain('not Pubky Ring');
      expect(html).toContain('http://localhost:3000/marketplace/settings');
      expect(html).toContain('opaque-state');
    });
  });
});

describe('paykit setup sandbox HTTP stub', () => {
  it('labels Bitkit setup as a local stub without an invoice', async () => {
    const server = createPaykitSetupSandboxHttpServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    try {
      const response = await realFetch(
        `http://127.0.0.1:${address.port}/setup?return_to=https://app.example.com/marketplace/settings&state=setup-state`,
      );
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get('x-paykit-mode')).toBe('sandbox');
      expect(html).toContain('SANDBOX');
      expect(html).toContain('not Bitkit');
      expect(html).toContain('does not show a Bitcoin invoice');
      expect(html).toContain('setup-state');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
