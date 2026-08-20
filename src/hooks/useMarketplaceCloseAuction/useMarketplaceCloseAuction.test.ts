import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceCloseAuction } from './useMarketplaceCloseAuction';

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    executeMarketplaceCommand: vi.fn(),
  },
}));

vi.mock('@/molecules/Toaster/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useMarketplaceCloseAuction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000001600');
  });

  it('closes the auction against the current revision', async () => {
    vi.mocked(CommerceController.executeMarketplaceCommand).mockResolvedValue({
      ok: true,
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001600',
      aggregateId: 'listing:seller_item',
      revision: 4,
      eventIds: ['00000000-0000-4000-8000-000000001601'],
      result: { kind: 'auction_result' },
    });

    const { result } = renderHook(() => useMarketplaceCloseAuction('listing:seller_item', 3));
    await expect(result.current.submit()).resolves.toBe(true);
    expect(CommerceController.executeMarketplaceCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: 'listing:seller_item',
        expectedRevision: 3,
        kind: 'auction.close',
        payload: {},
      }),
    );
  });

  it('does not submit without an authoritative revision', async () => {
    const { result } = renderHook(() => useMarketplaceCloseAuction('listing:seller_item', null));
    await expect(result.current.submit()).resolves.toBe(false);
    expect(CommerceController.executeMarketplaceCommand).not.toHaveBeenCalled();
  });
});
