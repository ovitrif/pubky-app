import { describe, expect, it } from 'vitest';
import { marketplaceTrustFacts } from './trust-indicators';

describe('marketplaceTrustFacts', () => {
  it('separates transaction-service facts from seller-declared profile fields', () => {
    const facts = marketplaceTrustFacts({
      shop: {
        name: 'Satoshi Vintage',
        bio: 'Used denim and boots.',
        location: { countryCode: 'US', region: 'NY' },
        shippingPolicy: 'Ships in three days.',
        returnPolicy: '30-day returns.',
        vacationMode: true,
      },
      reputation: {
        salesCount: 4,
        reviewCount: 2,
        averageRating: 4.5,
        responseTimeHours: 6,
        itemAccuracy: 5,
        shipping: 4,
        communication: 5,
      },
      listingRevision: 3,
    });

    expect(facts.verified).toEqual(
      expect.arrayContaining([
        { label: 'Identity', value: 'Owner-signed Pubky shop and listings' },
        { label: 'Sales', value: '4 completed' },
        { label: 'Reviews', value: '4.5 average · 2 reviews' },
        { label: 'Item accuracy', value: '5' },
        { label: 'Listing revision', value: '3' },
      ]),
    );
    expect(facts.selfDeclared).toEqual(
      expect.arrayContaining([
        { label: 'Shop name', value: 'Satoshi Vintage' },
        { label: 'Location', value: 'NY, US' },
        { label: 'Vacation mode', value: 'On (seller-declared)' },
        { label: 'Return policy', value: '30-day returns.' },
      ]),
    );
  });

  it('labels missing reputation as unverified marketplace facts, not seller copy', () => {
    const facts = marketplaceTrustFacts({ shop: null, reputation: null });
    expect(facts.verified.find(({ label }) => label === 'Sales')?.value).toBe('No marketplace sales yet');
    expect(facts.selfDeclared.find(({ label }) => label === 'Bio')?.value).toBe('Not published');
  });
});
