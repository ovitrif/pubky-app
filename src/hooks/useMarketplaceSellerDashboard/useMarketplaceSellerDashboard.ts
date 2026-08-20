'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceOffers } from '@/hooks/useMarketplaceOffers/useMarketplaceOffers';
import { useMarketplaceOrders } from '@/hooks/useMarketplaceOrders/useMarketplaceOrders';
import { exportMarketplaceInventoryCsv, parseMarketplaceInventoryCsv } from '@/libs/commerce/inventory-csv';
import { buildMarketplacePromotionAggregateId } from '@/libs/commerce/transaction-commands';
import { toast } from '@/molecules/Toaster/use-toast';
import type {
  MarketplacePromotion,
  MarketplaceSellerAnalytics,
  MarketplaceSellerStatement,
} from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export function useMarketplaceSellerDashboard() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const localListings = useLiveQuery(
    () => (currentUserPubky ? CommerceController.getListingsBySeller(currentUserPubky) : []),
    [currentUserPubky],
  );
  const orders = useMarketplaceOrders();
  const offers = useMarketplaceOffers();
  const sellerOrders = orders.orders.filter(({ order }) => order.sellerPubky === currentUserPubky);
  const activeListings = (localListings ?? []).filter(({ state }) => state === 'active');
  const totalInventory = activeListings.reduce(
    (total, listing) => total + listing.record.variants.reduce((sum, variant) => sum + variant.quantity, 0),
    0,
  );
  const revenueMinor = sellerOrders
    .filter(({ order }) => ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(order.state))
    .reduce((total, { order }) => total + order.total.amountMinor, 0);
  const [promotions, setPromotions] = useState<MarketplacePromotion[]>([]);
  const [statement, setStatement] = useState<MarketplaceSellerStatement | null>(null);
  const [analytics, setAnalytics] = useState<MarketplaceSellerAnalytics | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [percentOff, setPercentOff] = useState('10');
  const toShip = sellerOrders.filter(({ order }) => ['paid', 'processing'].includes(order.state)).length;
  const returnsOpen = sellerOrders.filter(({ order }) =>
    ['return_requested', 'return_in_transit', 'return_inspection'].includes(order.state),
  ).length;
  const disputesOpen = sellerOrders.filter(({ order }) => order.state === 'disputed').length;

  useEffect(() => {
    if (!currentUserPubky) return;
    let active = true;
    Promise.all([
      CommerceController.getMarketplacePromotions(),
      CommerceController.getMarketplaceStatement(),
      CommerceController.getMarketplaceAnalytics(),
    ])
      .then(([nextPromotions, nextStatement, nextAnalytics]) => {
        if (!active) return;
        setPromotions(nextPromotions);
        setStatement(nextStatement);
        setAnalytics(nextAnalytics);
      })
      .catch(() => {
        if (!active) return;
        setPromotions([]);
        setStatement(null);
        setAnalytics(null);
      });
    return () => {
      active = false;
    };
  }, [currentUserPubky]);

  const refreshFinance = async () => {
    if (!currentUserPubky) return;
    try {
      const [nextPromotions, nextStatement, nextAnalytics] = await Promise.all([
        CommerceController.getMarketplacePromotions(),
        CommerceController.getMarketplaceStatement(),
        CommerceController.getMarketplaceAnalytics(),
      ]);
      setPromotions(nextPromotions);
      setStatement(nextStatement);
      setAnalytics(nextAnalytics);
    } catch {
      setPromotions([]);
      setStatement(null);
      setAnalytics(null);
    }
  };

  const updateListingState = async (listingIds: string[], state: 'active' | 'paused' | 'removed') => {
    const selected = (localListings ?? []).filter(({ id }) => listingIds.includes(id));
    try {
      await Promise.all(
        selected.map(({ record }) =>
          CommerceController.commitUpsertListing({
            ...record,
            revision: record.revision + 1,
            state,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
      toast({
        title: state === 'active' ? 'Listings activated' : state === 'paused' ? 'Listings paused' : 'Listings removed',
      });
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not update selected listings.' });
      return false;
    }
  };

  const duplicateListing = async (listingId: string) => {
    const listing = (localListings ?? []).find(({ id }) => id === listingId);
    if (!listing) return false;
    const now = new Date().toISOString();
    const nextId = crypto.randomUUID().replaceAll('-', '');
    try {
      await CommerceController.commitUpsertListing({
        ...listing.record,
        listingId: nextId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        state: 'paused',
        title: `${listing.record.title} (copy)`,
      });
      toast({ title: 'Listing duplicated', description: 'The copy is paused until you activate it.' });
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not duplicate this listing.' });
      return false;
    }
  };

  const createPromotion = async () => {
    if (!currentUserPubky) return false;
    const code = couponCode.trim().toUpperCase();
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: buildMarketplacePromotionAggregateId(currentUserPubky, code),
        expectedRevision: 0,
        issuedAt: new Date().toISOString(),
        kind: 'promotion.create',
        payload: {
          code,
          percentOff: Number(percentOff),
          usageLimit: 100,
          expiresInSeconds: 30 * 24 * 60 * 60,
        },
      });
      if (!response.ok) {
        toast({ variant: 'error', description: response.error.message });
        return false;
      }
      setCouponCode('');
      await refreshFinance();
      toast({ title: 'Coupon created', description: `${code} is ready for sandbox checkout.` });
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not create this coupon.' });
      return false;
    }
  };

  const releasePayout = async (orderId: string, expectedRevision: number) => {
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `order:${orderId}`,
        expectedRevision,
        issuedAt: new Date().toISOString(),
        kind: 'payout.release',
        payload: { orderId },
      });
      if (!response.ok) {
        toast({ variant: 'error', description: response.error.message });
        return false;
      }
      await Promise.all([orders.refresh(), refreshFinance()]);
      toast({ title: 'Sandbox payout released' });
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not release this sandbox payout.' });
      return false;
    }
  };

  const importCsv = async (text: string) => {
    const rows = parseMarketplaceInventoryCsv(text);
    const byId = new Map((localListings ?? []).map((listing) => [listing.listing_id, listing]));
    let updated = 0;
    try {
      for (const row of rows) {
        const listing = byId.get(row.listingId);
        if (!listing || listing.state === row.state) continue;
        await CommerceController.commitUpsertListing({
          ...listing.record,
          revision: listing.record.revision + 1,
          state: row.state,
          updatedAt: new Date().toISOString(),
        });
        updated += 1;
      }
      toast({ title: 'Inventory import preview applied', description: `${updated} listing states updated.` });
      return updated;
    } catch {
      toast({ variant: 'error', description: 'Could not import this inventory CSV.' });
      return 0;
    }
  };

  return {
    listings: localListings ?? [],
    sellerOrders,
    offers: offers.offers.filter(({ sellerPubky }) => sellerPubky === currentUserPubky),
    promotions,
    statement,
    analytics,
    couponCode,
    percentOff,
    setCouponCode,
    setPercentOff,
    isLoading: localListings === undefined || orders.isLoading || offers.isLoading,
    metrics: {
      activeListings: activeListings.length,
      totalInventory,
      lowStock: activeListings.filter((listing) =>
        listing.record.variants.some((variant) => variant.enabled && variant.quantity <= 1),
      ).length,
      paidOrders: sellerOrders.filter(({ order }) => order.state !== 'pending_payment').length,
      revenueMinor,
      openOffers: offers.offers.filter(
        ({ sellerPubky, state }) => sellerPubky === currentUserPubky && (state === 'pending' || state === 'countered'),
      ).length,
      views: analytics?.views ?? 0,
      favorites: analytics?.favorites ?? 0,
      conversionPercent: analytics?.conversionPercent ?? 0,
      sellThroughPercent: analytics?.sellThroughPercent ?? 0,
      toShip: analytics?.toShip ?? toShip,
      returnsOpen: analytics?.returnsOpen ?? returnsOpen,
      disputesOpen: analytics?.disputesOpen ?? disputesOpen,
    },
    updateListingState,
    duplicateListing,
    createPromotion,
    releasePayout,
    importCsv,
    exportCsv: () => exportMarketplaceInventoryCsv(localListings ?? []),
  };
}
