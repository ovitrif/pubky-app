import { describe, expect, it } from 'vitest';
import { createCommerceSandboxCatalog } from '@/libs/commerce/sandbox-catalog';
import type { CommerceListingModelSchema } from '@/models/commerce/commerce.schema';
import { exportMarketplaceInventoryCsv, parseMarketplaceInventoryCsv } from './inventory-csv';

describe('inventory CSV', () => {
  it('round-trips listing identity and state', () => {
    const listing = createCommerceSandboxCatalog().listings[0];
    const price = listing.sale.format === 'fixed_price' ? listing.sale.unitPrice : listing.sale.startingPrice;
    const model: CommerceListingModelSchema = {
      id: `${listing.ownerPubky}:${listing.listingId}`,
      seller_id: listing.ownerPubky,
      listing_id: listing.listingId,
      record: listing,
      revision: listing.revision,
      state: listing.state,
      category_id: listing.categoryId,
      format: listing.sale.format,
      currency: price.currency,
      price_minor: price.amountMinor,
      sync_status: 'synced',
      updated_at: Date.parse(listing.updatedAt),
    };

    const parsed = parseMarketplaceInventoryCsv(exportMarketplaceInventoryCsv([model]));
    expect(parsed).toEqual([
      expect.objectContaining({
        listingId: listing.listingId,
        state: listing.state,
        currency: price.currency,
      }),
    ]);
  });
});
