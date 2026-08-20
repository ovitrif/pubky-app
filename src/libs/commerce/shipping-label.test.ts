import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';
import { printMarketplaceReverseLabel, printMarketplaceShippingLabel } from './shipping-label';

const order = {
  id: '43a8f872-ce9b-4481-82e2-a7abef0c9ac7',
  state: 'paid',
  total: { amountMinor: 14_796, currency: 'USD', exponent: 2 },
  deliveryAddress: {
    name: 'Alice Buyer',
    line1: '1 Market Street',
    line2: '',
    city: 'New York',
    region: 'NY',
    postalCode: '10001',
    countryCode: 'US',
  },
} as MarketplaceOrder;

describe('printMarketplaceShippingLabel', () => {
  const write = vi.fn();
  const close = vi.fn();
  const focus = vi.fn();
  const print = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'open',
      vi.fn(() => ({ document: { write, close }, focus, print })),
    );
  });

  it('opens a labeled sandbox shipping label and does not claim carrier postage', () => {
    printMarketplaceShippingLabel(order);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Sandbox shipping label'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('not a carrier-scannable label'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Alice Buyer'));
    expect(print).toHaveBeenCalled();
  });

  it('opens a labeled sandbox reverse label without claiming postage or a refund', () => {
    printMarketplaceReverseLabel({ ...order, sellerPubky: 'y'.repeat(52) });
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Sandbox reverse label'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('does not move Bitcoin'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('SBR-43A8F872CE9B'));
    expect(print).toHaveBeenCalled();
  });
});
