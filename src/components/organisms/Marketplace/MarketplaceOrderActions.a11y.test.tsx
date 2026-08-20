import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';
import { asOpaque } from '@/test-utils/type-assertions';
import { MarketplaceOrderActions } from './MarketplaceOrderActions';

const order = asOpaque<MarketplaceOrder>({
  id: '43a8f872-ce9b-4481-82e2-a7abef0c9ac7',
  buyerPubky: 'b'.repeat(52),
  sellerPubky: 'y'.repeat(52),
  revision: 3,
  state: 'shipped',
  fulfillment: 'physical',
  total: { amountMinor: 14_796, currency: 'USD', exponent: 2 },
  shipment: {
    carrier: 'Sandbox Post',
    trackingNumber: 'TRACK-123',
    state: 'shipped',
    shippedAt: '2026-08-20T22:00:00.000Z',
    deliveredAt: null,
    exception: null,
  },
  reviews: [],
});

describe('MarketplaceOrderActions accessibility', () => {
  it('has no serious or critical automated violations on shipped-order actions', async () => {
    const { container } = render(
      <MarketplaceOrderActions order={order} isBuyer actOnOrder={vi.fn(async () => true)} />,
    );
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
