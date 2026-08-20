import { describe, expect, it } from 'vitest';
import { isMarketplaceGuestCartOwner, MARKETPLACE_GUEST_CART_OWNER, marketplaceCartOwner } from './guest-cart';

describe('marketplaceCartOwner', () => {
  it('uses a reserved local owner when no session is present', () => {
    expect(marketplaceCartOwner(null)).toBe(MARKETPLACE_GUEST_CART_OWNER);
    expect(marketplaceCartOwner(undefined)).toBe(MARKETPLACE_GUEST_CART_OWNER);
    expect(isMarketplaceGuestCartOwner(MARKETPLACE_GUEST_CART_OWNER)).toBe(true);
  });

  it('keeps signed-in carts on the real pubky', () => {
    const buyer = 'y'.repeat(52);
    expect(marketplaceCartOwner(buyer)).toBe(buyer);
    expect(isMarketplaceGuestCartOwner(buyer)).toBe(false);
  });
});
