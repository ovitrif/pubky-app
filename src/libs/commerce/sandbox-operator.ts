import { getCommerceAdapterMode } from '@/config/commerce';
import { MARKETPLACE_SANDBOX_MODERATOR, MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY } from './sandbox-actors';

export function isMarketplaceSandboxOperator(): boolean {
  if (typeof window === 'undefined') return false;
  if (getCommerceAdapterMode() !== 'sandbox') return false;
  try {
    return window.sessionStorage.getItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function marketplaceStaffActor(currentUserPubky: string): string {
  return isMarketplaceSandboxOperator() ? MARKETPLACE_SANDBOX_MODERATOR : currentUserPubky;
}

export function marketplaceCommandActor(currentUserPubky: string, kind: string): string {
  if ((kind.startsWith('trust.') && kind !== 'trust.report') || kind === 'inventory.reconcile_paid') {
    return marketplaceStaffActor(currentUserPubky);
  }
  return currentUserPubky;
}
