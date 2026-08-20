import { describe, expect, it } from 'vitest';
import {
  createMarketplaceCallbackNonceStore,
  MARKETPLACE_SANDBOX_CALLBACK_SECRET,
  marketplaceCallbackHeaders,
  marketplaceCallbackSecretFromEnv,
  signMarketplaceCallback,
  verifyMarketplaceCallback,
} from './signed-callback';

const NOW = Date.parse('2026-08-20T22:00:00.000Z');
const BODY =
  '{"version":1,"paymentId":"00000000-0000-4000-8000-000000001900","target":"confirmed","confirmations":1,"commandId":"00000000-0000-4000-8000-000000001901"}';
const NONCE = 'ab'.repeat(16);

describe('signed marketplace callbacks', () => {
  it('accepts a fresh HMAC over the exact body and rejects tampering', () => {
    const secret = MARKETPLACE_SANDBOX_CALLBACK_SECRET;
    const signature = signMarketplaceCallback({ secret, timestampMs: NOW, nonce: NONCE, rawBody: BODY });
    const nonces = createMarketplaceCallbackNonceStore();

    expect(
      verifyMarketplaceCallback({
        secret,
        timestampHeader: String(NOW),
        nonce: NONCE,
        signature,
        rawBody: BODY,
        nowMs: NOW,
        nonces,
      }),
    ).toEqual({ ok: true, timestampMs: NOW });

    expect(
      verifyMarketplaceCallback({
        secret,
        timestampHeader: String(NOW),
        nonce: 'cd'.repeat(16),
        signature,
        rawBody: BODY,
        nowMs: NOW,
        nonces,
      }).ok,
    ).toBe(false);

    expect(
      verifyMarketplaceCallback({
        secret,
        timestampHeader: String(NOW),
        nonce: 'ef'.repeat(16),
        signature,
        rawBody: BODY.replace('confirmed', 'expired'),
        nowMs: NOW,
        nonces,
      }),
    ).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
  });

  it('rejects expired, future, and replayed nonces', () => {
    const secret = MARKETPLACE_SANDBOX_CALLBACK_SECRET;
    const nonces = createMarketplaceCallbackNonceStore();
    const headers = marketplaceCallbackHeaders({ secret, timestampMs: NOW, nonce: NONCE, rawBody: BODY });

    expect(
      verifyMarketplaceCallback({
        secret,
        timestampHeader: headers['x-marketplace-callback-timestamp'] ?? '',
        nonce: NONCE,
        signature: headers['x-marketplace-callback-signature'] ?? '',
        rawBody: BODY,
        nowMs: NOW + 6 * 60 * 1000,
        nonces,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('replay window') });

    expect(
      verifyMarketplaceCallback({
        secret,
        timestampHeader: String(NOW + 60_000),
        nonce: NONCE,
        signature: signMarketplaceCallback({ secret, timestampMs: NOW + 60_000, nonce: NONCE, rawBody: BODY }),
        rawBody: BODY,
        nowMs: NOW,
        nonces,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('future') });

    const accepted = verifyMarketplaceCallback({
      secret,
      timestampHeader: String(NOW),
      nonce: NONCE,
      signature: signMarketplaceCallback({ secret, timestampMs: NOW, nonce: NONCE, rawBody: BODY }),
      rawBody: BODY,
      nowMs: NOW,
      nonces,
    });
    expect(accepted.ok).toBe(true);
    expect(
      verifyMarketplaceCallback({
        secret,
        timestampHeader: String(NOW),
        nonce: NONCE,
        signature: signMarketplaceCallback({ secret, timestampMs: NOW, nonce: NONCE, rawBody: BODY }),
        rawBody: BODY,
        nowMs: NOW + 1_000,
        nonces,
      }),
    ).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('uses the labeled sandbox secret unless a long env secret is set', () => {
    expect(marketplaceCallbackSecretFromEnv({})).toBe(MARKETPLACE_SANDBOX_CALLBACK_SECRET);
    expect(marketplaceCallbackSecretFromEnv({ MARKETPLACE_CALLBACK_SECRET: 'short' })).toBe(
      MARKETPLACE_SANDBOX_CALLBACK_SECRET,
    );
    expect(marketplaceCallbackSecretFromEnv({ MARKETPLACE_CALLBACK_SECRET: 'production-callback-secret' })).toBe(
      'production-callback-secret',
    );
  });
});
