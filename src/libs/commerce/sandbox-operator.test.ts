import { afterEach, describe, expect, it, vi } from 'vitest';
import * as commerceConfig from '@/config/commerce';
import { MARKETPLACE_SANDBOX_MODERATOR, MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY } from './sandbox-actors';
import { isMarketplaceSandboxOperator, marketplaceCommandActor, marketplaceStaffActor } from './sandbox-operator';

const USER = 'y'.repeat(52);

describe('sandbox operator', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the reserved moderator only in sandbox with the local operator flag', () => {
    vi.spyOn(commerceConfig, 'getCommerceAdapterMode').mockReturnValue('sandbox');
    expect(isMarketplaceSandboxOperator()).toBe(false);
    expect(marketplaceStaffActor(USER)).toBe(USER);
    expect(marketplaceCommandActor(USER, 'trust.decide')).toBe(USER);

    sessionStorage.setItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY, '1');
    expect(isMarketplaceSandboxOperator()).toBe(true);
    expect(marketplaceStaffActor(USER)).toBe(MARKETPLACE_SANDBOX_MODERATOR);
    expect(marketplaceCommandActor(USER, 'trust.assign')).toBe(MARKETPLACE_SANDBOX_MODERATOR);
    expect(marketplaceCommandActor(USER, 'trust.report')).toBe(USER);
    expect(marketplaceCommandActor(USER, 'checkout.create')).toBe(USER);
  });

  it('never elevates staff identity outside sandbox', () => {
    vi.spyOn(commerceConfig, 'getCommerceAdapterMode').mockReturnValue('locks-paykit');
    sessionStorage.setItem(MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY, '1');
    expect(isMarketplaceSandboxOperator()).toBe(false);
    expect(marketplaceCommandActor(USER, 'trust.decide')).toBe(USER);
  });
});
