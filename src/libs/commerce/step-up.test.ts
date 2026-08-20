import { describe, expect, it } from 'vitest';
import {
  issueMarketplaceStepUpToken,
  MARKETPLACE_SANDBOX_STEP_UP_SECRET,
  marketplaceStepUpSecretFromEnv,
  stepUpPurposeForCommand,
  verifyMarketplaceStepUpToken,
} from './step-up';

const ACTOR = 'p'.repeat(52);
const OTHER = 'z'.repeat(52);
const NOW = Date.parse('2026-08-20T22:00:00.000Z');

describe('marketplace step-up tokens', () => {
  it('maps only privileged staff mutations to a purpose', () => {
    expect(stepUpPurposeForCommand('inventory.reconcile_paid')).toBe('finance');
    expect(stepUpPurposeForCommand('refund.record_external')).toBe('finance');
    expect(stepUpPurposeForCommand('risk.hold')).toBe('risk');
    expect(stepUpPurposeForCommand('risk.release')).toBe('risk');
    expect(stepUpPurposeForCommand('trust.decide')).toBe('moderation');
    expect(stepUpPurposeForCommand('trust.reverse')).toBe('moderation');
    expect(stepUpPurposeForCommand('trust.assign')).toBeNull();
    expect(stepUpPurposeForCommand('trust.flag_risk')).toBeNull();
    expect(stepUpPurposeForCommand('support.note')).toBeNull();
    expect(stepUpPurposeForCommand('payment.sandbox_advance')).toBeNull();
  });

  it('accepts an actor-and-purpose bound token inside its ttl', () => {
    const issued = issueMarketplaceStepUpToken({
      actorPubky: ACTOR,
      purpose: 'finance',
      secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
      nowMs: NOW,
    });

    expect(
      verifyMarketplaceStepUpToken({
        token: issued.token,
        actorPubky: ACTOR,
        purpose: 'finance',
        secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
        nowMs: NOW + 1_000,
      }),
    ).toEqual({ ok: true });
    expect(issued.purpose).toBe('finance');
    expect(Date.parse(issued.expiresAt)).toBe(NOW + issued.ttlMs);
  });

  it('rejects expired, wrong-actor, wrong-purpose, and tampered tokens', () => {
    const issued = issueMarketplaceStepUpToken({
      actorPubky: ACTOR,
      purpose: 'finance',
      secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
      nowMs: NOW,
    });

    expect(
      verifyMarketplaceStepUpToken({
        token: issued.token,
        actorPubky: ACTOR,
        purpose: 'finance',
        secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
        nowMs: NOW + issued.ttlMs,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('expired') });

    expect(
      verifyMarketplaceStepUpToken({
        token: issued.token,
        actorPubky: OTHER,
        purpose: 'finance',
        secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
        nowMs: NOW,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('different actor') });

    expect(
      verifyMarketplaceStepUpToken({
        token: issued.token,
        actorPubky: ACTOR,
        purpose: 'risk',
        secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
        nowMs: NOW,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('does not cover') });

    expect(
      verifyMarketplaceStepUpToken({
        token: `${issued.token.slice(0, -2)}aa`,
        actorPubky: ACTOR,
        purpose: 'finance',
        secret: MARKETPLACE_SANDBOX_STEP_UP_SECRET,
        nowMs: NOW,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining('signature') });
  });

  it('uses the labeled sandbox secret unless a long env secret is set', () => {
    expect(marketplaceStepUpSecretFromEnv({})).toBe(MARKETPLACE_SANDBOX_STEP_UP_SECRET);
    expect(marketplaceStepUpSecretFromEnv({ MARKETPLACE_STEP_UP_SECRET: 'short' })).toBe(
      MARKETPLACE_SANDBOX_STEP_UP_SECRET,
    );
  });
});
