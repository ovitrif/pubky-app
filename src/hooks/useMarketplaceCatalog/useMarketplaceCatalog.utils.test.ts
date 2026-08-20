import { describe, expect, it } from 'vitest';
import { createCommerceSandboxCatalog } from '@/libs/commerce/sandbox-catalog';
import type { CommerceListingModelSchema } from '@/models/commerce/commerce.schema';
import {
  buildMarketplaceFeedSections,
  filterMarketplaceCatalog,
  type MarketplaceCatalogFilters,
  relatedMarketplaceListings,
} from './useMarketplaceCatalog.utils';

function catalogModels(): CommerceListingModelSchema[] {
  return createCommerceSandboxCatalog().listings.map((record) => {
    const price = record.sale.format === 'auction' ? record.sale.startingPrice : record.sale.unitPrice;
    return {
      id: `${record.ownerPubky}:${record.listingId}`,
      seller_id: record.ownerPubky,
      listing_id: record.listingId,
      record,
      revision: record.revision,
      state: record.state,
      category_id: record.categoryId,
      format: record.sale.format,
      currency: price.currency,
      price_minor: price.amountMinor,
      sync_status: 'synced',
      updated_at: Date.parse(record.updatedAt),
    };
  });
}

function filters(overrides: Partial<MarketplaceCatalogFilters> = {}): MarketplaceCatalogFilters {
  return {
    query: '',
    categoryId: null,
    saleFormat: 'all',
    conditions: [],
    minimumPriceMinor: null,
    maximumPriceMinor: null,
    sort: 'newest',
    ...overrides,
  };
}

describe('filterMarketplaceCatalog', () => {
  it('searches title, description, and tags case-insensitively', () => {
    const results = filterMarketplaceCatalog(catalogModels(), filters({ query: 'JAZZ' }));

    expect(results.map(({ listing_id }) => listing_id)).toEqual(['jazz_first_press']);
  });

  it('matches a category subtree', () => {
    const results = filterMarketplaceCatalog(catalogModels(), filters({ categoryId: 'fashion-shoes' }));

    expect(results.map(({ listing_id }) => listing_id).sort()).toEqual(['leather_boots', 'trail_runners']);
  });

  it('combines format, condition, and inclusive price filters', () => {
    const results = filterMarketplaceCatalog(
      catalogModels(),
      filters({
        saleFormat: 'fixed_price',
        conditions: ['excellent'],
        minimumPriceMinor: 8_000,
        maximumPriceMinor: 14_000,
      }),
    );

    expect(results.map(({ listing_id }) => listing_id).sort()).toEqual([
      'denim_jacket',
      'mechanical_keyboard',
      'selvedge_jacket',
    ]);
  });

  it('sorts price in both directions', () => {
    const low = filterMarketplaceCatalog(catalogModels(), filters({ sort: 'price_low' }));
    const high = filterMarketplaceCatalog(catalogModels(), filters({ sort: 'price_high' }));

    expect(low[0].listing_id).toBe('pattern_pack');
    expect(high[0].listing_id).toBe('mechanical_keyboard');
  });

  it('filters watcher-only offer listings', () => {
    const results = filterMarketplaceCatalog(catalogModels(), filters({ saleFormat: 'offer' }));

    expect(results.map(({ listing_id }) => listing_id)).toEqual(['sample_coat']);
  });

  it('puts active auctions before fixed-price listings for ending-soon', () => {
    const results = filterMarketplaceCatalog(catalogModels(), filters({ sort: 'ending_soon' }));

    expect(results.slice(0, 2).every(({ format }) => format === 'auction')).toBe(true);
  });

  it('hides restricted listings from discovery while keeping related-item matches', () => {
    const models = catalogModels();
    const restricted = `listing:${models[0].seller_id}_${models[0].listing_id}`;
    const visible = filterMarketplaceCatalog(models, filters({ restrictedAggregateIds: [restricted] }));
    expect(visible.map(({ listing_id }) => listing_id)).not.toContain(models[0].listing_id);

    const related = relatedMarketplaceListings(models, models[0]);
    expect(related.every(({ id }) => id !== models[0].id)).toBe(true);
    expect(related.length).toBeGreaterThan(0);
    const sections = buildMarketplaceFeedSections(models, [models[0].seller_id], [restricted]);
    expect(sections.recommended.map(({ listing_id }) => listing_id)).not.toContain(models[0].listing_id);
  });
});
