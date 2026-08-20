import { buildMarketplaceListingAggregateId } from '@/libs/commerce/transaction-commands';
import type { CommerceListingModelSchema } from '@/models/commerce/commerce.schema';
import type { CommerceConditionFilter, CommerceSaleFormatFilter, CommerceSort } from '@/stores/commerce/commerce.types';

export interface MarketplaceCatalogFilters {
  query: string;
  categoryId: string | null;
  saleFormat: CommerceSaleFormatFilter;
  conditions: CommerceConditionFilter[];
  minimumPriceMinor: number | null;
  maximumPriceMinor: number | null;
  sort: CommerceSort;
  restrictedAggregateIds?: string[];
}

export function filterMarketplaceCatalog(
  listings: CommerceListingModelSchema[],
  filters: MarketplaceCatalogFilters,
): CommerceListingModelSchema[] {
  const query = filters.query.trim().toLocaleLowerCase('en-US');
  const restricted = new Set(filters.restrictedAggregateIds ?? []);
  const filtered = listings.filter((listing) => {
    const record = listing.record;
    const searchable = [record.title, record.description, ...record.tags].join(' ').toLocaleLowerCase('en-US');
    return (
      record.state === 'active' &&
      !restricted.has(buildMarketplaceListingAggregateId(record.ownerPubky, record.listingId)) &&
      (query === '' || searchable.includes(query)) &&
      (filters.categoryId === null ||
        record.categoryId === filters.categoryId ||
        record.categoryId.startsWith(`${filters.categoryId}-`)) &&
      (filters.saleFormat === 'all' || record.sale.format === filters.saleFormat) &&
      (filters.conditions.length === 0 || filters.conditions.includes(record.condition)) &&
      (filters.minimumPriceMinor === null || listing.price_minor >= filters.minimumPriceMinor) &&
      (filters.maximumPriceMinor === null || listing.price_minor <= filters.maximumPriceMinor)
    );
  });

  return filtered.sort((left, right) => {
    switch (filters.sort) {
      case 'newest':
        return right.updated_at - left.updated_at;
      case 'price_low':
        return left.price_minor - right.price_minor;
      case 'price_high':
        return right.price_minor - left.price_minor;
      case 'ending_soon':
        return auctionEnd(left) - auctionEnd(right);
      case 'recommended':
        return recommendationScore(right) - recommendationScore(left);
    }
  });
}

function auctionEnd(listing: CommerceListingModelSchema): number {
  return listing.record.sale.format === 'auction' ? Date.parse(listing.record.sale.endsAt) : Number.MAX_SAFE_INTEGER;
}

function recommendationScore(listing: CommerceListingModelSchema): number {
  const auctionBoost = listing.record.sale.format === 'auction' ? 10_000 : 0;
  const conditionBoost = listing.record.condition === 'new' || listing.record.condition === 'excellent' ? 5_000 : 0;
  return listing.updated_at + auctionBoost + conditionBoost;
}

const sectionFilters: MarketplaceCatalogFilters = {
  query: '',
  categoryId: null,
  saleFormat: 'all',
  conditions: [],
  minimumPriceMinor: null,
  maximumPriceMinor: null,
  sort: 'recommended',
};

export function buildMarketplaceFeedSections(
  listings: CommerceListingModelSchema[],
  followedSellerIds: string[],
  restrictedAggregateIds: string[] = [],
) {
  const visible = filterMarketplaceCatalog(listings, { ...sectionFilters, restrictedAggregateIds });
  return {
    recommended: filterMarketplaceCatalog(listings, {
      ...sectionFilters,
      sort: 'recommended',
      restrictedAggregateIds,
    }).slice(0, 8),
    following: visible.filter((listing) => followedSellerIds.includes(listing.seller_id)).slice(0, 8),
    newest: filterMarketplaceCatalog(listings, { ...sectionFilters, sort: 'newest', restrictedAggregateIds }).slice(
      0,
      8,
    ),
    endingSoon: filterMarketplaceCatalog(listings, {
      ...sectionFilters,
      saleFormat: 'auction',
      sort: 'ending_soon',
      restrictedAggregateIds,
    }).slice(0, 8),
  };
}

export function relatedMarketplaceListings(
  listings: CommerceListingModelSchema[],
  current: CommerceListingModelSchema,
  limit = 4,
): CommerceListingModelSchema[] {
  return listings
    .filter(
      (listing) =>
        listing.id !== current.id &&
        listing.state === 'active' &&
        (listing.category_id === current.category_id || listing.seller_id === current.seller_id),
    )
    .slice(0, limit);
}
