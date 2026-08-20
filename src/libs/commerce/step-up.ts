import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { timingSafeEqualHex } from './signed-callback';
import { commercePubkySchema } from './transaction-contracts';

export const MARKETPLACE_STEP_UP_HEADER = 'x-marketplace-step-up';
export const MARKETPLACE_STEP_UP_TTL_MS = 5 * 60 * 1000;
export const MARKETPLACE_SANDBOX_STEP_UP_SECRET = 'pubky-marketplace-sandbox-step-up-v1';
export const MARKETPLACE_STEP_UP_PURPOSES = ['moderation', 'risk', 'finance'] as const;

export type MarketplaceStepUpPurpose = (typeof MARKETPLACE_STEP_UP_PURPOSES)[number];

const STEP_UP_COMMAND_PURPOSE: Record<string, MarketplaceStepUpPurpose> = {
  'trust.decide': 'moderation',
  'trust.reverse': 'moderation',
  'risk.hold': 'risk',
  'risk.release': 'risk',
  'inventory.reconcile_paid': 'finance',
  'refund.record_external': 'finance',
};

const stepUpPayloadSchema = z
  .object({
    v: z.literal(1),
    actor: commercePubkySchema,
    purpose: z.enum(MARKETPLACE_STEP_UP_PURPOSES),
    iat: z.number().int(),
    exp: z.number().int(),
    jti: z.string().regex(/^[a-f0-9]{32}$/),
  })
  .strict();

export function marketplaceStepUpSecretFromEnv(env: Record<string, string | undefined> = process.env): string {
  const configured = env.MARKETPLACE_STEP_UP_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : MARKETPLACE_SANDBOX_STEP_UP_SECRET;
}

export function stepUpPurposeForCommand(kind: string): MarketplaceStepUpPurpose | null {
  return STEP_UP_COMMAND_PURPOSE[kind] ?? null;
}

export function issueMarketplaceStepUpToken({
  actorPubky,
  purpose,
  secret,
  nowMs,
  ttlMs = MARKETPLACE_STEP_UP_TTL_MS,
  jti,
}: {
  actorPubky: string;
  purpose: MarketplaceStepUpPurpose;
  secret: string;
  nowMs: number;
  ttlMs?: number;
  jti?: string;
}): { token: string; expiresAt: string; purpose: MarketplaceStepUpPurpose; ttlMs: number } {
  const payload = {
    v: 1 as const,
    actor: actorPubky,
    purpose,
    iat: nowMs,
    exp: nowMs + ttlMs,
    jti: jti ?? bytesToHex(sha256(new TextEncoder().encode(`${actorPubky}:${purpose}:${nowMs}`))).slice(0, 32),
  };
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return {
    token: `${encoded}.${signStepUpPayload(secret, encoded)}`,
    expiresAt: new Date(payload.exp).toISOString(),
    purpose,
    ttlMs,
  };
}

export function verifyMarketplaceStepUpToken({
  token,
  actorPubky,
  purpose,
  secret,
  nowMs,
}: {
  token: string;
  actorPubky: string;
  purpose: MarketplaceStepUpPurpose;
  secret: string;
  nowMs: number;
}): { ok: true } | { ok: false; reason: string } {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return { ok: false, reason: 'A marketplace step-up token is required.' };
  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/.test(signature)) return { ok: false, reason: 'The marketplace step-up token is malformed.' };
  const expected = signStepUpPayload(secret, encoded);
  if (!timingSafeEqualHex(expected, signature)) {
    return { ok: false, reason: 'The marketplace step-up token signature is invalid.' };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
  } catch {
    return { ok: false, reason: 'The marketplace step-up token payload is invalid.' };
  }
  const parsed = stepUpPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: 'The marketplace step-up token payload is invalid.' };
  if (parsed.data.actor !== actorPubky) {
    return { ok: false, reason: 'The marketplace step-up token is bound to a different actor.' };
  }
  if (parsed.data.purpose !== purpose) {
    return { ok: false, reason: 'The marketplace step-up token does not cover this command.' };
  }
  if (nowMs >= parsed.data.exp) return { ok: false, reason: 'The marketplace step-up token has expired.' };
  if (nowMs + 1_000 < parsed.data.iat) return { ok: false, reason: 'The marketplace step-up token is not yet valid.' };
  return { ok: true };
}

function signStepUpPayload(secret: string, encodedPayload: string): string {
  return bytesToHex(hmac(sha256, new TextEncoder().encode(secret), new TextEncoder().encode(encodedPayload)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(`${padded}${pad}`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
