export const MARKETPLACE_RECENTLY_VIEWED_KEY = 'pubky.marketplace.recentlyViewed';
export const MARKETPLACE_RECENTLY_VIEWED_LIMIT = 8;

export interface RecentlyViewedListingRef {
  sellerPubky: string;
  listingId: string;
}

export function readRecentlyViewedListingRefs(storage: Pick<Storage, 'getItem'> | null): RecentlyViewedListingRef[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(MARKETPLACE_RECENTLY_VIEWED_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecentlyViewedListingRef)
      .filter((entry, index, all) => all.findIndex((item) => sameListingRef(item, entry)) === index)
      .slice(0, MARKETPLACE_RECENTLY_VIEWED_LIMIT);
  } catch {
    return [];
  }
}

export function recordRecentlyViewedListing(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  ref: RecentlyViewedListingRef,
): RecentlyViewedListingRef[] {
  if (!storage || !isRecentlyViewedListingRef(ref)) return [];
  const next = [ref, ...readRecentlyViewedListingRefs(storage).filter((entry) => !sameListingRef(entry, ref))].slice(
    0,
    MARKETPLACE_RECENTLY_VIEWED_LIMIT,
  );
  storage.setItem(MARKETPLACE_RECENTLY_VIEWED_KEY, JSON.stringify(next));
  return next;
}

function isRecentlyViewedListingRef(value: unknown): value is RecentlyViewedListingRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RecentlyViewedListingRef).sellerPubky === 'string' &&
    (value as RecentlyViewedListingRef).sellerPubky.length === 52 &&
    typeof (value as RecentlyViewedListingRef).listingId === 'string' &&
    (value as RecentlyViewedListingRef).listingId.length > 0
  );
}

function sameListingRef(left: RecentlyViewedListingRef, right: RecentlyViewedListingRef): boolean {
  return left.sellerPubky === right.sellerPubky && left.listingId === right.listingId;
}
