import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useAuthStore } from '@/stores/auth/auth.store';
import { useMarketplaceSupport } from './useMarketplaceSupport';

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    getMarketplaceStaffOrders: vi.fn(),
    searchMarketplaceAdmin: vi.fn(),
    executeMarketplaceCommand: vi.fn(),
  },
}));

vi.mock('@/libs/commerce/sandbox-operator', () => ({
  isMarketplaceSandboxOperator: () => true,
  setMarketplaceSandboxStaffRole: vi.fn(),
}));

const ORDER = {
  id: '00000000-0000-4000-8000-000000001700',
  revision: 2,
  state: 'paid',
  fulfillment: 'pickup',
  inventoryState: 'sold',
  total: { amountMinor: 14_796, currency: 'USD', exponent: 2 },
  deliveryAddress: { city: 'New York', region: 'NY', countryCode: 'US', name: '[redacted]', line1: '[redacted]' },
  supportNotes: [],
};

describe('useMarketplaceSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ currentUserPubky: 'y'.repeat(52) });
    vi.mocked(CommerceController.getMarketplaceStaffOrders).mockResolvedValue([ORDER as never]);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000001701');
  });

  it('loads redacted staff orders and posts a support note', async () => {
    vi.mocked(CommerceController.executeMarketplaceCommand).mockResolvedValue({
      ok: true,
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001701',
      aggregateId: `order:${ORDER.id}`,
      revision: 3,
      eventIds: ['00000000-0000-4000-8000-000000001702'],
      result: { kind: 'order' },
    });
    const { result } = renderHook(() => useMarketplaceSupport());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.orders).toEqual([ORDER]);

    await act(async () => {
      result.current.setNote('Buyer asked about pickup hours.');
    });
    await act(async () => {
      await result.current.addNote(ORDER as never);
    });
    expect(CommerceController.executeMarketplaceCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'support.note',
        payload: { orderId: ORDER.id, text: 'Buyer asked about pickup hours.' },
      }),
    );
  });
});
