import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { toast } from '@/molecules/Toaster/use-toast';
import { useMarketplaceCart } from './useMarketplaceCart';

const state = vi.hoisted(() => ({
  currentUserPubky: null as string | null,
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (query: () => unknown) => query(),
}));

vi.mock('@/stores/auth/auth.store', () => ({
  useAuthStore: (selector: (store: { currentUserPubky: string | null }) => unknown) =>
    selector({ currentUserPubky: state.currentUserPubky }),
}));

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    getCartItems: vi.fn(async () => []),
    getListing: vi.fn(),
    commitAddCartItem: vi.fn(),
    commitUpsertCartItem: vi.fn(),
    commitDeleteCartItem: vi.fn(),
    commitClearCart: vi.fn(),
    mergeGuestCart: vi.fn(),
  },
}));

vi.mock('@/molecules/Toaster/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useMarketplaceCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentUserPubky = null;
  });

  it('adds a guest cart line without opening sign-in', async () => {
    const listingId = `${'y'.repeat(52)}:leather_boots`;
    vi.mocked(CommerceController.getListing).mockResolvedValue({
      record: { sale: { format: 'fixed_price' } },
    } as never);

    const { result } = renderHook(() => useMarketplaceCart());
    await act(async () => {
      await result.current.add(listingId, 'default', 2);
    });

    expect(CommerceController.commitAddCartItem).toHaveBeenCalledWith(listingId, 'default', 2);
    expect(toast).toHaveBeenCalledWith({ title: 'Added to cart' });
    expect(CommerceController.mergeGuestCart).not.toHaveBeenCalled();
  });

  it('merges the reserved guest cart after sign-in', () => {
    state.currentUserPubky = 'y'.repeat(52);
    renderHook(() => useMarketplaceCart());
    expect(CommerceController.mergeGuestCart).toHaveBeenCalledOnce();
  });
});
