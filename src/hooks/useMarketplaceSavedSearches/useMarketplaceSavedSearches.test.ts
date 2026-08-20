import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useAuthStore } from '@/stores/auth/auth.store';
import { useCommerceStore } from '@/stores/commerce/commerce.store';
import { useMarketplaceSavedSearches } from './useMarketplaceSavedSearches';

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    getSavedSearches: vi.fn(async () => []),
    commitUpsertSavedSearch: vi.fn(),
    commitDeleteSavedSearch: vi.fn(),
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

vi.mock('@/molecules/Toaster/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useMarketplaceSavedSearches', () => {
  beforeEach(() => {
    useAuthStore.setState({ currentUserPubky: 'b'.repeat(52) } as never);
    useCommerceStore.getState().reset();
    useCommerceStore.getState().setQuery('camera');
    vi.mocked(CommerceController.commitUpsertSavedSearch).mockResolvedValue(undefined);
  });

  it('saves the current catalog filters for the signed-in account', async () => {
    const { result } = renderHook(() => useMarketplaceSavedSearches());
    await result.current.save();

    expect(CommerceController.commitUpsertSavedSearch).toHaveBeenCalledWith({
      name: 'camera',
      query: 'camera',
      categoryId: null,
      saleFormat: 'all',
    });
  });
});
