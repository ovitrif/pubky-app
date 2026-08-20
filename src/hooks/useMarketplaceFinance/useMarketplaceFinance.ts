'use client';

import { useEffect, useState } from 'react';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceStaffPage } from '@/hooks/useMarketplaceStaffPage/useMarketplaceStaffPage';
import type { MarketplaceLedgerEntry, MarketplaceOrder } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export function useMarketplaceFinance() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const staff = useMarketplaceStaffPage('finance');
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [entries, setEntries] = useState<MarketplaceLedgerEntry[]>([]);
  const [invariants, setInvariants] = useState<{
    unbalancedOrders: string[];
    reservedOnPaidOrders: string[];
  } | null>(null);
  const [orderId, setOrderId] = useState('');
  const [amountMinor, setAmountMinor] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!currentUserPubky) return;
    const [nextOrders, nextEntries, nextInvariants] = await Promise.all([
      CommerceController.getMarketplaceStaffOrders(),
      CommerceController.getMarketplaceStaffLedger(),
      CommerceController.getMarketplaceInvariants().catch(() => null),
    ]);
    setOrders(nextOrders);
    setEntries(nextEntries);
    setInvariants(nextInvariants);
  };

  useEffect(() => {
    if (!currentUserPubky || !staff.ready) {
      setIsLoading(Boolean(currentUserPubky) && !staff.ready);
      return;
    }
    refresh()
      .catch(() => setError('This account does not have marketplace finance access.'))
      .finally(() => setIsLoading(false));
    // refresh is recreated each render; React Compiler memoizes the hook body.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount refresh only
  }, [currentUserPubky, staff.ready]);

  const recordRefund = async () => {
    const order = orders.find(({ id }) => id === orderId.trim());
    const amount = Number.parseInt(amountMinor, 10);
    if (!order || !Number.isInteger(amount) || amount <= 0 || transactionId.trim().length < 8) {
      setError('Enter an eligible order, positive amount, and external transaction id.');
      return;
    }
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `order:${order.id}`,
        expectedRevision: order.revision,
        issuedAt: new Date().toISOString(),
        kind: 'refund.record_external',
        payload: { orderId: order.id, amountMinor: amount, transactionId: transactionId.trim() },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setTransactionId('');
      await refresh();
    } catch {
      setError('Could not record this external refund.');
    }
  };

  const reconcilePaidInventory = async () => {
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: 'inventory:reconcile',
        expectedRevision: 0,
        issuedAt: new Date().toISOString(),
        kind: 'inventory.reconcile_paid',
        payload: {},
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      const convertedIds = 'convertedOrderIds' in response.result ? response.result.convertedOrderIds : [];
      const converted = Array.isArray(convertedIds) ? convertedIds.length : 0;
      setReconcileResult(
        converted === 0
          ? 'No reserved paid orders needed conversion.'
          : `Converted reserved inventory on ${converted} paid order${converted === 1 ? '' : 's'}.`,
      );
      await refresh();
    } catch {
      setError('Could not reconcile paid inventory.');
    }
  };

  return {
    orders,
    entries,
    invariants,
    orderId,
    setOrderId,
    amountMinor,
    setAmountMinor,
    transactionId,
    setTransactionId,
    reconcileResult,
    isLoading,
    error,
    recordRefund,
    reconcilePaidInventory,
    isOperator: staff.isOperator,
  };
}
