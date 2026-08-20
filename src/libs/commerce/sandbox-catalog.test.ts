import { describe, expect, it } from 'vitest';
import { commerceListingRecordSchema, commerceShopRecordSchema } from './marketplace-records';
import { createCommerceSandboxCatalog } from './sandbox-catalog';

describe('createCommerceSandboxCatalog', () => {
  it('builds a deterministic, schema-valid catalog with matching projections', () => {
    const first = createCommerceSandboxCatalog();
    const second = createCommerceSandboxCatalog();

    expect(first).toEqual(second);
    expect(first.shops).toHaveLength(10);
    expect(first.listings).toHaveLength(10);
    expect(first.projections).toHaveLength(10);
    expect(
      first.listings.some((listing) => listing.fulfillmentMethods.includes('digital') && listing.digitalLock),
    ).toBe(true);
    expect(first.listings.some((listing) => listing.sale.format === 'offer')).toBe(true);
    expect(
      first.listings.some((listing) => listing.listingId === 'leather_boots' && listing.variants[0].quantity === 4),
    ).toBe(true);
    expect(first.shops.some((shop) => shop.vacationMode && shop.name === 'Soft Fork Studio')).toBe(true);
    expect(
      first.listings.some(
        (listing) =>
          listing.listingId === 'ceramic_vase' &&
          listing.sale.format === 'fixed_price' &&
          listing.sale.autoAcceptAmount?.amountMinor === 6_000,
      ),
    ).toBe(true);
    expect(first.shops.every((shop) => commerceShopRecordSchema.safeParse(shop).success)).toBe(true);
    expect(first.listings.every((listing) => commerceListingRecordSchema.safeParse(listing).success)).toBe(true);

    const listingRevisions = new Map(
      first.listings.map((listing) => [`${listing.ownerPubky}:${listing.listingId}`, listing.revision]),
    );
    expect(
      first.projections.every((projection) => listingRevisions.get(projection.id) === projection.listing_revision),
    ).toBe(true);
  });

  it('covers fixed-price, auction, fashion, electronics, home, and collectibles discovery', () => {
    const { listings } = createCommerceSandboxCatalog();

    expect(new Set(listings.map(({ sale }) => sale.format))).toEqual(new Set(['fixed_price', 'auction', 'offer']));
    expect(new Set(listings.flatMap(({ fulfillmentMethods }) => fulfillmentMethods))).toEqual(
      new Set(['pickup', 'digital']),
    );
    expect(new Set(listings.map(({ categoryId }) => categoryId.split('-')[0]))).toEqual(
      new Set(['fashion', 'electronics', 'home', 'collectibles']),
    );
  });
});
