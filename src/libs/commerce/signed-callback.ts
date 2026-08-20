import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { z } from 'zod';

export const MARKETPLACE_CALLBACK_TIMESTAMP_HEADER = 'x-marketplace-callback-timestamp';
export const MARKETPLACE_CALLBACK_NONCE_HEADER = 'x-marketplace-callback-nonce';
export const MARKETPLACE_CALLBACK_SIGNATURE_HEADER = 'x-marketplace-callback-signature';
export const MARKETPLACE_CALLBACK_MAX_AGE_MS = 5 * 60 * 1000;
export const MARKETPLACE_CALLBACK_MAX_FUTURE_SKEW_MS = 30_000;
export const MARKETPLACE_SANDBOX_CALLBACK_SECRET = 'pubky-marketplace-sandbox-callback-v1';

export const marketplacePaymentCallbackSchema = z
  .object({
    version: z.literal(1),
    paymentId: z.uuid(),
    target: z.enum(['detected', 'confirmed', 'expired', 'manual_review']),
    confirmations: z.number().int().min(0).max(6),
    commandId: z.uuid(),
  })
  .strict();

export type MarketplacePaymentCallback = z.infer<typeof marketplacePaymentCallbackSchema>;

export interface MarketplaceCallbackNonceStore {
  has(nonce: string): boolean;
  add(nonce: string, expiresAtMs: number): void;
  prune(nowMs: number): void;
}

export function createMarketplaceCallbackNonceStore(): MarketplaceCallbackNonceStore {
  const seen = new Map<string, number>();
  return {
    has(nonce) {
      return seen.has(nonce);
    },
    add(nonce, expiresAtMs) {
      seen.set(nonce, expiresAtMs);
    },
    prune(nowMs) {
      for (const [nonce, expiresAtMs] of seen) {
        if (expiresAtMs <= nowMs) seen.delete(nonce);
      }
    },
  };
}

export function marketplaceCallbackSecretFromEnv(env: Record<string, string | undefined> = process.env): string {
  const configured = env.MARKETPLACE_CALLBACK_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : MARKETPLACE_SANDBOX_CALLBACK_SECRET;
}

export function canonicalMarketplaceCallbackPayload(timestampMs: number, nonce: string, rawBody: string): string {
  return `v1.${timestampMs}.${nonce}.${bytesToHex(sha256(new TextEncoder().encode(rawBody)))}`;
}

export function signMarketplaceCallback({
  secret,
  timestampMs,
  nonce,
  rawBody,
}: {
  secret: string;
  timestampMs: number;
  nonce: string;
  rawBody: string;
}): string {
  return bytesToHex(
    hmac(
      sha256,
      new TextEncoder().encode(secret),
      new TextEncoder().encode(canonicalMarketplaceCallbackPayload(timestampMs, nonce, rawBody)),
    ),
  );
}

export function marketplaceCallbackHeaders({
  secret,
  timestampMs,
  nonce,
  rawBody,
}: {
  secret: string;
  timestampMs: number;
  nonce: string;
  rawBody: string;
}): Record<string, string> {
  return {
    'content-type': 'application/json',
    [MARKETPLACE_CALLBACK_TIMESTAMP_HEADER]: String(timestampMs),
    [MARKETPLACE_CALLBACK_NONCE_HEADER]: nonce,
    [MARKETPLACE_CALLBACK_SIGNATURE_HEADER]: signMarketplaceCallback({ secret, timestampMs, nonce, rawBody }),
  };
}

export function verifyMarketplaceCallback({
  secret,
  timestampHeader,
  nonce,
  signature,
  rawBody,
  nowMs,
  nonces,
  maxAgeMs = MARKETPLACE_CALLBACK_MAX_AGE_MS,
  maxFutureSkewMs = MARKETPLACE_CALLBACK_MAX_FUTURE_SKEW_MS,
}: {
  secret: string;
  timestampHeader: string;
  nonce: string;
  signature: string;
  rawBody: string;
  nowMs: number;
  nonces: MarketplaceCallbackNonceStore;
  maxAgeMs?: number;
  maxFutureSkewMs?: number;
}): { ok: true; timestampMs: number } | { ok: false; reason: string; code: 'UNAUTHORIZED' | 'IDEMPOTENCY_CONFLICT' } {
  if (!/^[a-f0-9]{32}$/.test(nonce)) {
    return { ok: false, reason: 'Callback nonce must be 16 random bytes as hex.', code: 'UNAUTHORIZED' };
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) {
    return { ok: false, reason: 'Callback signature is missing or malformed.', code: 'UNAUTHORIZED' };
  }
  const timestampMs = Number.parseInt(timestampHeader, 10);
  if (!Number.isSafeInteger(timestampMs)) {
    return { ok: false, reason: 'Callback timestamp is missing or malformed.', code: 'UNAUTHORIZED' };
  }
  if (timestampMs > nowMs + maxFutureSkewMs) {
    return { ok: false, reason: 'Callback timestamp is too far in the future.', code: 'UNAUTHORIZED' };
  }
  if (nowMs - timestampMs > maxAgeMs) {
    return { ok: false, reason: 'Callback timestamp is outside the replay window.', code: 'UNAUTHORIZED' };
  }
  const expected = signMarketplaceCallback({ secret, timestampMs, nonce, rawBody });
  if (!timingSafeEqualHex(expected, signature)) {
    return { ok: false, reason: 'Callback signature does not match the signed body.', code: 'UNAUTHORIZED' };
  }
  nonces.prune(nowMs);
  if (nonces.has(nonce)) {
    return { ok: false, reason: 'Callback nonce was already consumed.', code: 'IDEMPOTENCY_CONFLICT' };
  }
  nonces.add(nonce, timestampMs + maxAgeMs);
  return { ok: true, timestampMs };
}

export function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
