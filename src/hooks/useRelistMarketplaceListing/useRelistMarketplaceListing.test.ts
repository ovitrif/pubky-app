import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { createCommerceListingFixture } from '@/test/fixtures/commerce/commerce';
import { useRelistMarketplaceListing } from './useRelistMarketplaceListing';

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    commitUpsertListing: vi.fn(),
  },
}));

vi.mock('@/molecules/Toaster/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useRelistMarketplaceListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('018f47d2-6a27-7c23-a49d-6b21bb770999');
  });

  it('publishes a new active listing from an existing record', async () => {
    const record = createCommerceListingFixture();
    const { result } = renderHook(() => useRelistMarketplaceListing());
    act(() => {
      result.current.form.setValue('price', '130.00');
      result.current.form.setValue('quantity', '2');
    });

    let createdId: string | null = null;
    await act(async () => {
      createdId = await result.current.submit(record);
    });

    expect(createdId).toBe(`${record.ownerPubky}:018f47d26a277c23a49d6b21bb770999`);
    expect(CommerceController.commitUpsertListing).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: '018f47d26a277c23a49d6b21bb770999',
        state: 'active',
        revision: 1,
        sale: expect.objectContaining({ unitPrice: expect.objectContaining({ amountMinor: 13_000 }) }),
        variants: [expect.objectContaining({ quantity: 2, enabled: true })],
      }),
    );
  });
});
