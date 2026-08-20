import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceBuyNow } from './useMarketplaceBuyNow';

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    executeMarketplaceCommand: vi.fn(),
  },
}));

vi.mock('@/molecules/Toaster/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useMarketplaceBuyNow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000001500');
  });

  it('closes the auction at the buy-now price against the current revision', async () => {
    vi.mocked(CommerceController.executeMarketplaceCommand).mockResolvedValue({
      ok: true,
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001500',
      aggregateId: 'listing:seller_item',
      revision: 4,
      eventIds: ['00000000-0000-4000-8000-000000001501'],
      result: { kind: 'auction_result' },
    });

    const { result } = renderHook(() => useMarketplaceBuyNow('listing:seller_item', 3));
    await expect(result.current.submit()).resolves.toBe(true);
    expect(CommerceController.executeMarketplaceCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: 'listing:seller_item',
        expectedRevision: 3,
        kind: 'auction.buy_now',
        payload: {},
      }),
    );
  });

  it('does not submit without an authoritative revision', async () => {
    const { result } = renderHook(() => useMarketplaceBuyNow('listing:seller_item', null));
    await expect(result.current.submit()).resolves.toBe(false);
    expect(CommerceController.executeMarketplaceCommand).not.toHaveBeenCalled();
  });
});
