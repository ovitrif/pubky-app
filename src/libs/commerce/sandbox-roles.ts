import {
  MARKETPLACE_SANDBOX_FINANCE,
  MARKETPLACE_SANDBOX_MODERATOR,
  MARKETPLACE_SANDBOX_RISK,
  MARKETPLACE_SANDBOX_STAFF_PUBKYS,
  MARKETPLACE_SANDBOX_STAFF_ROLES,
  MARKETPLACE_SANDBOX_SUPPORT,
  type MarketplaceSandboxStaffRole,
} from './sandbox-actors';

const STAFF_COMMANDS: Record<MarketplaceSandboxStaffRole, readonly string[]> = {
  moderator: ['trust.assign', 'trust.decide', 'trust.reverse', 'trust.flag_risk'],
  support: ['support.note'],
  risk: ['trust.flag_risk', 'risk.hold', 'risk.release'],
  finance: ['inventory.reconcile_paid', 'refund.record_external'],
};

export function marketplaceSandboxRoleForActor(actorPubky: string): MarketplaceSandboxStaffRole | null {
  for (const role of MARKETPLACE_SANDBOX_STAFF_ROLES) {
    if (MARKETPLACE_SANDBOX_STAFF_PUBKYS[role] === actorPubky) return role;
  }
  return null;
}

export function isSandboxModerator(actorPubky: string): boolean {
  return actorPubky === MARKETPLACE_SANDBOX_MODERATOR;
}

export function isSandboxSupport(actorPubky: string): boolean {
  return actorPubky === MARKETPLACE_SANDBOX_SUPPORT;
}

export function isSandboxRisk(actorPubky: string): boolean {
  return actorPubky === MARKETPLACE_SANDBOX_RISK;
}

export function isSandboxFinance(actorPubky: string): boolean {
  return actorPubky === MARKETPLACE_SANDBOX_FINANCE;
}

export function isSandboxStaff(actorPubky: string): boolean {
  return marketplaceSandboxRoleForActor(actorPubky) !== null;
}

export function staffCommandKindsForRole(role: MarketplaceSandboxStaffRole): readonly string[] {
  return STAFF_COMMANDS[role];
}

export function actorMayExecuteStaffKind(actorPubky: string, kind: string): boolean {
  const role = marketplaceSandboxRoleForActor(actorPubky);
  return role !== null && STAFF_COMMANDS[role].includes(kind);
}
