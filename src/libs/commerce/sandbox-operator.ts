import { getCommerceAdapterMode } from '@/config/commerce';
import {
  MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY,
  MARKETPLACE_SANDBOX_STAFF_PUBKYS,
  MARKETPLACE_SANDBOX_STAFF_ROLE_STORAGE_KEY,
  MARKETPLACE_SANDBOX_STAFF_ROLES,
  type MarketplaceSandboxStaffRole,
} from './sandbox-actors';
import { staffCommandKindsForRole } from './sandbox-roles';

export function isMarketplaceSandboxOperator(): boolean {
  if (typeof window === 'undefined') return false;
  if (getCommerceAdapterMode() !== 'sandbox') return false;
  try {
    return window.sessionStorage.getItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function getMarketplaceSandboxStaffRole(): MarketplaceSandboxStaffRole {
  if (typeof window === 'undefined') return 'moderator';
  try {
    const stored = window.sessionStorage.getItem(MARKETPLACE_SANDBOX_STAFF_ROLE_STORAGE_KEY);
    return MARKETPLACE_SANDBOX_STAFF_ROLES.find((role) => role === stored) ?? 'moderator';
  } catch {
    return 'moderator';
  }
}

export function setMarketplaceSandboxStaffRole(role: MarketplaceSandboxStaffRole): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(MARKETPLACE_SANDBOX_STAFF_ROLE_STORAGE_KEY, role);
  } catch {
    // sessionStorage may be unavailable in locked-down browsers
  }
}

export function marketplaceStaffActor(currentUserPubky: string): string {
  return isMarketplaceSandboxOperator()
    ? MARKETPLACE_SANDBOX_STAFF_PUBKYS[getMarketplaceSandboxStaffRole()]
    : currentUserPubky;
}

export function marketplaceCommandActor(currentUserPubky: string, kind: string): string {
  if (!isMarketplaceSandboxOperator()) return currentUserPubky;
  const role = getMarketplaceSandboxStaffRole();
  return staffCommandKindsForRole(role).includes(kind) ? MARKETPLACE_SANDBOX_STAFF_PUBKYS[role] : currentUserPubky;
}
