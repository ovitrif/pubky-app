import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_RECENTLY_VIEWED_KEY,
  MARKETPLACE_RECENTLY_VIEWED_LIMIT,
  readRecentlyViewedListingRefs,
  recordRecentlyViewedListing,
} from './recently-viewed';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

const FIRST = { sellerPubky: 'y'.repeat(52), listingId: 'leather_boots' };
const SECOND = { sellerPubky: 'n'.repeat(52), listingId: 'rangefinder_camera' };

describe('recently viewed listings', () => {
  it('records newest first, dedupes, and caps the list', () => {
    const storage = memoryStorage();

    expect(recordRecentlyViewedListing(storage, FIRST)).toEqual([FIRST]);
    expect(recordRecentlyViewedListing(storage, SECOND)).toEqual([SECOND, FIRST]);
    expect(recordRecentlyViewedListing(storage, FIRST)).toEqual([FIRST, SECOND]);

    for (let index = 0; index < MARKETPLACE_RECENTLY_VIEWED_LIMIT + 2; index += 1) {
      recordRecentlyViewedListing(storage, {
        sellerPubky: 'b'.repeat(52),
        listingId: `item_${index}`,
      });
    }

    const refs = readRecentlyViewedListingRefs(storage);
    expect(refs).toHaveLength(MARKETPLACE_RECENTLY_VIEWED_LIMIT);
    expect(refs.some((ref) => ref.listingId === 'leather_boots')).toBe(false);
    expect(JSON.parse(storage.data[MARKETPLACE_RECENTLY_VIEWED_KEY] ?? '[]')).toHaveLength(
      MARKETPLACE_RECENTLY_VIEWED_LIMIT,
    );
  });

  it('ignores invalid session payloads', () => {
    const storage = memoryStorage({
      [MARKETPLACE_RECENTLY_VIEWED_KEY]: '{"not":"an array"}',
    });
    expect(readRecentlyViewedListingRefs(storage)).toEqual([]);
    expect(readRecentlyViewedListingRefs(null)).toEqual([]);
    expect(recordRecentlyViewedListing(null, FIRST)).toEqual([]);
    expect(recordRecentlyViewedListing(storage, { sellerPubky: 'short', listingId: 'x' })).toEqual([]);
  });
});
