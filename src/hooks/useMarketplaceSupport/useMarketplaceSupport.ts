'use client';

import { useEffect, useState } from 'react';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceStaffPage } from '@/hooks/useMarketplaceStaffPage/useMarketplaceStaffPage';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export function useMarketplaceSupport() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const staff = useMarketplaceStaffPage('support');
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!currentUserPubky) return;
    const [nextOrders, nextSearch] = await Promise.all([
      CommerceController.getMarketplaceStaffOrders(),
      query.trim() ? CommerceController.searchMarketplaceAdmin(query).catch(() => null) : Promise.resolve(null),
    ]);
    const visibleIds = new Set((nextSearch?.orders ?? nextOrders).map((order) => order.id));
    setOrders(nextOrders.filter((order) => visibleIds.has(order.id)));
  };

  useEffect(() => {
    if (!currentUserPubky || !staff.ready) {
      setIsLoading(Boolean(currentUserPubky) && !staff.ready);
      return;
    }
    refresh()
      .catch(() => setError('This account does not have marketplace support access.'))
      .finally(() => setIsLoading(false));
    // refresh is recreated each render; React Compiler memoizes the hook body.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/query refresh only
  }, [currentUserPubky, query, staff.ready]);

  const addNote = async (order: MarketplaceOrder) => {
    if (!note.trim()) {
      setError('Enter a non-financial support note.');
      return;
    }
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `order:${order.id}`,
        expectedRevision: order.revision,
        issuedAt: new Date().toISOString(),
        kind: 'support.note',
        payload: { orderId: order.id, text: note.trim() },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setNote('');
      await refresh();
    } catch {
      setError('Could not record this support note.');
    }
  };

  return {
    orders,
    query,
    setQuery,
    note,
    setNote,
    selectedOrderId,
    setSelectedOrderId,
    isLoading,
    error,
    addNote,
    isOperator: staff.isOperator,
  };
}
