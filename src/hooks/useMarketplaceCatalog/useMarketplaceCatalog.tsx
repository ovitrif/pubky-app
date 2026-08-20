'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCommerceAdapterMode } from '@/config/commerce';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useAuthStore } from '@/stores/auth/auth.store';
import { useCommerceStore } from '@/stores/commerce/commerce.store';
import { buildMarketplaceFeedSections, filterMarketplaceCatalog } from './useMarketplaceCatalog.utils';

export function useMarketplaceCatalog() {
  const query = useCommerceStore((state) => state.query);
  const categoryId = useCommerceStore((state) => state.categoryId);
  const saleFormat = useCommerceStore((state) => state.saleFormat);
  const conditions = useCommerceStore((state) => state.conditions);
  const minimumPriceMinor = useCommerceStore((state) => state.minimumPriceMinor);
  const maximumPriceMinor = useCommerceStore((state) => state.maximumPriceMinor);
  const sort = useCommerceStore((state) => state.sort);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [restrictedAggregateIds, setRestrictedAggregateIds] = useState<string[]>([]);
  const adapterMode = getCommerceAdapterMode();
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const filtersAreDefault =
    query === '' && categoryId === null && saleFormat === 'all' && conditions.length === 0 && sort === 'recommended';

  useEffect(() => {
    let active = true;
    CommerceController.initializeSandboxCatalog()
      .then(async (seeded) => {
        if (!active) return;
        if (adapterMode === 'sandbox' || seeded) {
          setRestrictedAggregateIds(await CommerceController.getRestrictedListingIds().catch(() => []));
        }
      })
      .catch(() => {
        if (active) setInitializationError('The marketplace catalog could not be initialized.');
      });
    return () => {
      active = false;
    };
  }, [adapterMode]);

  const localListings = useLiveQuery(() => CommerceController.getAllListings(), []);
  const localShops = useLiveQuery(() => CommerceController.getAllShops(), []);
  const follows = useLiveQuery(
    () => (currentUserPubky ? CommerceController.getShopFollows() : Promise.resolve([])),
    [currentUserPubky],
  );
  const listings = filterMarketplaceCatalog(localListings ?? [], {
    query,
    categoryId,
    saleFormat,
    conditions,
    minimumPriceMinor,
    maximumPriceMinor,
    sort,
    restrictedAggregateIds,
  });
  const shopsBySeller = new Map((localShops ?? []).map(({ owner_id, record }) => [owner_id, record]));
  const sections = buildMarketplaceFeedSections(
    localListings ?? [],
    (follows ?? []).map(({ seller_id }) => seller_id),
    restrictedAggregateIds,
  );

  return {
    listings,
    shopsBySeller,
    sections,
    showFeedSections: filtersAreDefault,
    isLoading: localListings === undefined || localShops === undefined,
    initializationError,
    adapterMode,
  };
}
