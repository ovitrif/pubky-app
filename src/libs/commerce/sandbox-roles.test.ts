import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_SANDBOX_FINANCE,
  MARKETPLACE_SANDBOX_MODERATOR,
  MARKETPLACE_SANDBOX_RISK,
  MARKETPLACE_SANDBOX_SUPPORT,
} from './sandbox-actors';
import {
  actorMayExecuteStaffKind,
  isSandboxFinance,
  isSandboxModerator,
  isSandboxRisk,
  isSandboxStaff,
  isSandboxSupport,
  marketplaceSandboxRoleForActor,
} from './sandbox-roles';

const USER = 'y'.repeat(52);

describe('sandbox staff roles', () => {
  it('maps reserved pubkys to independent staff roles', () => {
    expect(marketplaceSandboxRoleForActor(MARKETPLACE_SANDBOX_MODERATOR)).toBe('moderator');
    expect(marketplaceSandboxRoleForActor(MARKETPLACE_SANDBOX_SUPPORT)).toBe('support');
    expect(marketplaceSandboxRoleForActor(MARKETPLACE_SANDBOX_RISK)).toBe('risk');
    expect(marketplaceSandboxRoleForActor(MARKETPLACE_SANDBOX_FINANCE)).toBe('finance');
    expect(marketplaceSandboxRoleForActor(USER)).toBeNull();
    expect(isSandboxStaff(USER)).toBe(false);
    expect(isSandboxModerator(MARKETPLACE_SANDBOX_MODERATOR)).toBe(true);
    expect(isSandboxSupport(MARKETPLACE_SANDBOX_SUPPORT)).toBe(true);
    expect(isSandboxRisk(MARKETPLACE_SANDBOX_RISK)).toBe(true);
    expect(isSandboxFinance(MARKETPLACE_SANDBOX_FINANCE)).toBe(true);
  });

  it('keeps finance out of moderation and support out of refunds', () => {
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_FINANCE, 'trust.decide')).toBe(false);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_FINANCE, 'refund.record_external')).toBe(true);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_FINANCE, 'inventory.reconcile_paid')).toBe(true);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_SUPPORT, 'refund.record_external')).toBe(false);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_SUPPORT, 'support.note')).toBe(true);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_RISK, 'trust.decide')).toBe(false);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_RISK, 'risk.hold')).toBe(true);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_MODERATOR, 'trust.decide')).toBe(true);
    expect(actorMayExecuteStaffKind(MARKETPLACE_SANDBOX_MODERATOR, 'inventory.reconcile_paid')).toBe(false);
  });
});
