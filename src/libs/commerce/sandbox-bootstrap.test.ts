import { describe, expect, it } from 'vitest';
import { MARKETPLACE_SANDBOX_BIDDER_A, MARKETPLACE_SANDBOX_BIDDER_B } from './sandbox-actors';
import { sandboxAuctionSeedPlan, sandboxListingNeedsReregister } from './sandbox-bootstrap';
import { createCommerceSandboxCatalog } from './sandbox-catalog';

describe('sandboxListingNeedsReregister', () => {
  it('re-registers when the public sale auto-accept threshold is missing on the service', () => {
    const vase = createCommerceSandboxCatalog().listings.find((listing) => listing.listingId === 'ceramic_vase');
    expect(vase).toBeDefined();
    expect(sandboxListingNeedsReregister(null, vase!)).toBe(true);
    expect(sandboxListingNeedsReregister({ autoAcceptAmount: null }, vase!)).toBe(true);
    expect(
      sandboxListingNeedsReregister(
        {
          autoAcceptAmount: { amountMinor: 6_000, currency: 'USD', exponent: 2 },
          availableQuantity: 1,
          shippingQuoteMinor: 1_200,
        },
        vase!,
      ),
    ).toBe(false);
  });

  it('re-registers only when service quantity is below the catalog', () => {
    const boots = createCommerceSandboxCatalog().listings.find((listing) => listing.listingId === 'leather_boots');
    expect(boots).toBeDefined();
    expect(
      sandboxListingNeedsReregister(
        {
          autoAcceptAmount: null,
          availableQuantity: 1,
          reservedQuantity: 0,
          soldQuantity: 0,
          shippingQuoteMinor: 1_200,
        },
        boots!,
      ),
    ).toBe(true);
    expect(
      sandboxListingNeedsReregister(
        {
          autoAcceptAmount: null,
          availableQuantity: 12,
          reservedQuantity: 0,
          soldQuantity: 0,
          shippingQuoteMinor: 1_200,
        },
        boots!,
      ),
    ).toBe(false);
    expect(
      sandboxListingNeedsReregister(
        {
          autoAcceptAmount: null,
          availableQuantity: 6,
          reservedQuantity: 6,
          soldQuantity: 0,
          shippingQuoteMinor: 1_200,
        },
        boots!,
      ),
    ).toBe(false);
  });
});

describe('sandboxAuctionSeedPlan', () => {
  it('places two proxy bids without using seller identities', () => {
    const camera = createCommerceSandboxCatalog().listings.find(
      (listing) => listing.listingId === 'rangefinder_camera',
    );
    expect(camera).toBeDefined();
    const unitPrice = { amountMinor: 4_500, currency: 'USD', exponent: 2 };
    const increment = { amountMinor: 500, currency: 'USD', exponent: 2 };

    expect(
      sandboxAuctionSeedPlan(camera!, {
        serverRevision: 1,
        unitPrice,
        auction: { bidCount: 0, minimumIncrement: increment },
      }),
    ).toEqual({
      bidderPubky: MARKETPLACE_SANDBOX_BIDDER_A,
      expectedRevision: 1,
      maximumAmount: { amountMinor: 8_500, currency: 'USD', exponent: 2 },
    });
    expect(
      sandboxAuctionSeedPlan(camera!, {
        serverRevision: 2,
        unitPrice,
        auction: { bidCount: 1, minimumIncrement: increment },
      }),
    ).toEqual({
      bidderPubky: MARKETPLACE_SANDBOX_BIDDER_B,
      expectedRevision: 2,
      maximumAmount: { amountMinor: 7_500, currency: 'USD', exponent: 2 },
    });
    expect(
      sandboxAuctionSeedPlan(camera!, {
        serverRevision: 3,
        unitPrice,
        auction: { bidCount: 2, minimumIncrement: increment },
      }),
    ).toBeNull();
  });
});
