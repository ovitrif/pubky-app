'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CommerceController } from '@/controllers/commerce/commerce';
import {
  readRecentlyViewedListingRefs,
  type RecentlyViewedListingRef,
  recordRecentlyViewedListing,
} from '@/libs/commerce/recently-viewed';
import type { CommerceListingModelSchema } from '@/models/commerce/commerce.schema';

export function useRecentlyViewedListings(): CommerceListingModelSchema[] {
  const [refs, setRefs] = useState<RecentlyViewedListingRef[]>([]);
  const listings = useLiveQuery(() => CommerceController.getAllListings(), []);

  useEffect(() => {
    setRefs(readRecentlyViewedListingRefs(window.sessionStorage));
  }, []);

  if (!listings) return [];
  return refs
    .map((ref) =>
      listings.find((listing) => listing.seller_id === ref.sellerPubky && listing.listing_id === ref.listingId),
    )
    .filter((listing): listing is CommerceListingModelSchema => listing != null);
}

export function useRecordRecentlyViewedListing(sellerPubky: string, listingId: string): void {
  useEffect(() => {
    recordRecentlyViewedListing(window.sessionStorage, { sellerPubky, listingId });
  }, [listingId, sellerPubky]);
}
