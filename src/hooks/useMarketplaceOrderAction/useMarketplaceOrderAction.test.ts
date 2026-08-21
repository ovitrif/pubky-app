import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';
import { asOpaque } from '@/test-utils/type-assertions';
import { useMarketplaceOrderAction } from './useMarketplaceOrderAction';

const order = asOpaque<MarketplaceOrder>({
  id: '91909bce-0eb3-4e89-a1ba-91b05a673b6b',
  buyerPubky: 'b'.repeat(52),
  sellerPubky: 'k'.repeat(52),
  revision: 8,
  state: 'disputed',
  fulfillment: 'digital',
  total: { amountMinor: 2592, currency: 'USD', exponent: 2 },
  dispute: {
    state: 'open',
    openedBy: 'b'.repeat(52),
    reason: 'Digital file still will not open after return request.',
    requestedRemedy: 'refund',
    resolution: null,
    rationale: null,
    openedAt: '2026-08-21T02:33:49.162Z',
    resolvedAt: null,
  },
});

describe('useMarketplaceOrderAction', () => {
  it('maps a moderator resolve onto dispute.resolve', async () => {
    const actOnOrder = vi.fn(async () => true);
    const { result } = renderHook(() => useMarketplaceOrderAction(order, actOnOrder));
    act(() => {
      result.current.setAction('dispute_resolve');
      result.current.form.setValue('reason', 'File hash matches the listing; grant a sandbox refund.');
      result.current.form.setValue('disputeResolution', 'buyer_refund');
    });
    await expect(result.current.submit()).resolves.toBe(true);
    expect(actOnOrder).toHaveBeenCalledWith(order, 'dispute.resolve', {
      resolution: 'buyer_refund',
      rationale: 'File hash matches the listing; grant a sandbox refund.',
    });
  });
});
