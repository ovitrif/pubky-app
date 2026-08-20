import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceShopSettings } from './useMarketplaceShopSettings';

const OWNER = 'y'.repeat(52);

vi.mock('@/stores/auth/auth.store', () => ({
  useAuthStore: (selector: (state: { currentUserPubky: string }) => unknown) => selector({ currentUserPubky: OWNER }),
}));

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    getShop: vi.fn(),
    commitUpsertShop: vi.fn(),
    getBlockedBuyers: vi.fn(),
    executeMarketplaceCommand: vi.fn(),
  },
}));

vi.mock('@/molecules/Toaster/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useMarketplaceShopSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CommerceController.getShop).mockResolvedValue(null);
    vi.mocked(CommerceController.getBlockedBuyers).mockResolvedValue([]);
    vi.mocked(CommerceController.executeMarketplaceCommand).mockResolvedValue({
      ok: true,
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001400',
      aggregateId: `blocked:${OWNER}`,
      revision: 1,
      eventIds: [],
      result: { kind: 'blocked_buyer' },
    });
  });

  it('preserves shop collections when publishing policies', async () => {
    vi.mocked(CommerceController.getShop).mockResolvedValue({
      id: OWNER,
      owner_id: OWNER,
      revision: 2,
      sync_status: 'synced',
      updated_at: 1,
      record: {
        schemaVersion: 1,
        recordType: 'shop',
        ownerPubky: OWNER,
        revision: 2,
        createdAt: '2026-08-19T20:00:00.000Z',
        updatedAt: '2026-08-19T21:00:00.000Z',
        name: 'Satoshi Vintage',
        bio: 'Independent circular fashion.',
        location: { countryCode: 'US' },
        shippingPolicy: 'Ships within three business days.',
        returnPolicy: 'Returns accepted within 30 days unless marked final sale.',
        vacationMode: false,
        collections: [{ id: 'leather_boots_featured', name: 'Featured', listingIds: ['leather_boots'] }],
      },
    });

    const { result } = renderHook(() => useMarketplaceShopSettings());
    await waitFor(() => expect(result.current.revision).toBe(2));
    await act(() => result.current.submit());

    expect(CommerceController.commitUpsertShop).toHaveBeenCalledWith(
      expect.objectContaining({
        collections: [{ id: 'leather_boots_featured', name: 'Featured', listingIds: ['leather_boots'] }],
      }),
    );
  });

  it('publishes versioned owner-signed shop policies', async () => {
    const { result } = renderHook(() => useMarketplaceShopSettings());
    act(() => {
      result.current.form.setValue('name', 'Satoshi Vintage');
      result.current.form.setValue('bio', 'Independent circular fashion.');
    });

    await act(() => result.current.submit());

    expect(CommerceController.commitUpsertShop).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerPubky: OWNER,
        revision: 1,
        name: 'Satoshi Vintage',
        shippingPolicy: expect.any(String),
        returnPolicy: expect.any(String),
        vacationMode: false,
      }),
    );
  });
});
