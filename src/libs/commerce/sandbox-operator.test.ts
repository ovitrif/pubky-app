import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCommerceAdapterMode } from '@/config/commerce';
import {
  MARKETPLACE_SANDBOX_FINANCE,
  MARKETPLACE_SANDBOX_MODERATOR,
  MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY,
  MARKETPLACE_SANDBOX_RISK,
  MARKETPLACE_SANDBOX_SUPPORT,
} from './sandbox-actors';
import {
  getMarketplaceSandboxStaffRole,
  isMarketplaceSandboxOperator,
  marketplaceCommandActor,
  marketplaceStaffActor,
  setMarketplaceSandboxStaffRole,
} from './sandbox-operator';

vi.mock('@/config/commerce', () => ({
  getCommerceAdapterMode: vi.fn(() => 'sandbox'),
}));

const USER = 'y'.repeat(52);

describe('sandbox operator', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.mocked(getCommerceAdapterMode).mockReturnValue('sandbox');
  });

  it('is off until the sandbox operator flag is set', () => {
    expect(isMarketplaceSandboxOperator()).toBe(false);
    expect(marketplaceStaffActor(USER)).toBe(USER);
  });

  it('defaults operator staff commands to the reserved moderator', () => {
    sessionStorage.setItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY, '1');
    expect(isMarketplaceSandboxOperator()).toBe(true);
    expect(getMarketplaceSandboxStaffRole()).toBe('moderator');
    expect(marketplaceStaffActor(USER)).toBe(MARKETPLACE_SANDBOX_MODERATOR);
    expect(marketplaceCommandActor(USER, 'trust.assign')).toBe(MARKETPLACE_SANDBOX_MODERATOR);
    expect(marketplaceCommandActor(USER, 'inventory.reconcile_paid')).toBe(USER);
    expect(marketplaceCommandActor(USER, 'checkout.create')).toBe(USER);
  });

  it('maps the selected staff role onto reserved actors', () => {
    sessionStorage.setItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY, '1');
    setMarketplaceSandboxStaffRole('support');
    expect(marketplaceStaffActor(USER)).toBe(MARKETPLACE_SANDBOX_SUPPORT);
    expect(marketplaceCommandActor(USER, 'support.note')).toBe(MARKETPLACE_SANDBOX_SUPPORT);
    expect(marketplaceCommandActor(USER, 'trust.decide')).toBe(USER);
    setMarketplaceSandboxStaffRole('finance');
    expect(marketplaceStaffActor(USER)).toBe(MARKETPLACE_SANDBOX_FINANCE);
    expect(marketplaceCommandActor(USER, 'refund.record_external')).toBe(MARKETPLACE_SANDBOX_FINANCE);
    expect(marketplaceCommandActor(USER, 'trust.decide')).toBe(USER);
    setMarketplaceSandboxStaffRole('risk');
    expect(marketplaceStaffActor(USER)).toBe(MARKETPLACE_SANDBOX_RISK);
    expect(marketplaceCommandActor(USER, 'risk.hold')).toBe(MARKETPLACE_SANDBOX_RISK);
  });

  it('stays closed outside sandbox mode', () => {
    sessionStorage.setItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY, '1');
    vi.mocked(getCommerceAdapterMode).mockReturnValue('locks-paykit');
    expect(isMarketplaceSandboxOperator()).toBe(false);
  });
});
