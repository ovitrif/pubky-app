import { describe, expect, it } from 'vitest';
import { createMarketplaceListingDefaults, createMarketplaceListingSchema } from './useCreateMarketplaceListing.types';

describe('createMarketplaceListingSchema', () => {
  it('accepts complete physical delivery terms', () => {
    expect(
      createMarketplaceListingSchema.safeParse({
        ...createMarketplaceListingDefaults,
        title: 'Vintage leather boots',
        description: 'Well cared for boots with light wear.',
        price: '125.00',
        shippingPrice: '12.00',
        weightGrams: '1200',
        lengthMillimeters: '350',
        widthMillimeters: '250',
        heightMillimeters: '150',
        altText: 'Brown leather boots viewed from the side',
      }).success,
    ).toBe(true);
  });

  it('allows pickup without package or shipping fields', () => {
    expect(
      createMarketplaceListingSchema.safeParse({
        ...createMarketplaceListingDefaults,
        title: 'Vintage leather boots',
        description: 'Well cared for boots with light wear.',
        price: '125',
        fulfillment: 'pickup',
        altText: 'Brown leather boots viewed from the side',
      }).success,
    ).toBe(true);
  });

  it('allows digital fulfillment without package or shipping fields', () => {
    expect(
      createMarketplaceListingSchema.safeParse({
        ...createMarketplaceListingDefaults,
        title: 'Sewing pattern pack',
        description: 'Downloadable pattern pack.',
        price: '24',
        fulfillment: 'digital',
        altText: 'Pattern pack cover',
      }).success,
    ).toBe(true);
  });

  it('supports multiple fixed-price variants but only one auction variant', () => {
    const variants = [
      { sku: 'BOOTS-42', optionValues: ['42', 'Brown', ''], quantity: '1', priceOverride: '' },
      { sku: 'BOOTS-43', optionValues: ['43', 'Brown', ''], quantity: '2', priceOverride: '135.00' },
    ];
    const base = {
      ...createMarketplaceListingDefaults,
      title: 'Vintage leather boots',
      description: 'Well cared for boots with light wear.',
      price: '125',
      fulfillment: 'pickup' as const,
      altText: 'Brown leather boots viewed from the side',
      variants,
    };

    expect(createMarketplaceListingSchema.safeParse(base).success).toBe(true);
    expect(createMarketplaceListingSchema.safeParse({ ...base, saleFormat: 'auction' }).success).toBe(false);
    expect(createMarketplaceListingSchema.safeParse({ ...base, saleFormat: 'offer' }).success).toBe(false);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        saleFormat: 'offer',
        variants: [variants[0]],
      }).success,
    ).toBe(true);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        saleFormat: 'auction',
        variants: [variants[0]],
        buyNowPrice: '200',
      }).success,
    ).toBe(true);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        saleFormat: 'auction',
        variants: [variants[0]],
        buyNowPrice: '100',
      }).success,
    ).toBe(false);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        autoAcceptPrice: '130',
      }).success,
    ).toBe(false);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        price: '125',
        autoAcceptPrice: '120',
      }).success,
    ).toBe(true);
  });

  it('requires unique non-empty seller SKUs', () => {
    const duplicate = { sku: 'BOOTS', optionValues: ['', '', ''], quantity: '1', priceOverride: '' };
    expect(
      createMarketplaceListingSchema.safeParse({
        ...createMarketplaceListingDefaults,
        title: 'Vintage leather boots',
        description: 'Well cared for boots with light wear.',
        price: '125',
        fulfillment: 'pickup',
        altText: 'Brown leather boots',
        variants: [duplicate, { ...duplicate, optionValues: ['43', '', ''] }],
      }).success,
    ).toBe(false);
  });

  it.each([
    ['zero price', { price: '0' }],
    ['fractional cents', { price: '1.001' }],
    [
      'zero quantity',
      {
        variants: [
          {
            ...createMarketplaceListingDefaults.variants[0],
            quantity: '0',
          },
        ],
      },
    ],
    ['invalid country', { countryCode: 'USA' }],
    ['missing alt text', { altText: '' }],
  ])('rejects %s', (_label, changes) => {
    const result = createMarketplaceListingSchema.safeParse({
      ...createMarketplaceListingDefaults,
      title: 'Vintage leather boots',
      description: 'Well cared for boots with light wear.',
      price: '125',
      fulfillment: 'pickup',
      altText: 'Brown leather boots',
      ...changes,
    });

    expect(result.success).toBe(false);
  });

  it('accepts renamed option dimensions and rejects duplicate names', () => {
    const base = {
      ...createMarketplaceListingDefaults,
      title: 'Vintage leather boots',
      description: 'Well cared for boots with light wear.',
      price: '125',
      fulfillment: 'pickup' as const,
      altText: 'Brown leather boots',
      optionDimensions: [{ name: 'Material' }, { name: 'Fit' }],
      variants: [{ sku: 'BOOTS-42', optionValues: ['Leather', 'Regular'], quantity: '1', priceOverride: '' }],
    };
    expect(createMarketplaceListingSchema.safeParse(base).success).toBe(true);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        optionDimensions: [{ name: 'Size' }, { name: 'size' }],
      }).success,
    ).toBe(false);
    expect(
      createMarketplaceListingSchema.safeParse({
        ...base,
        variants: [{ sku: 'BOOTS-42', optionValues: ['Leather'], quantity: '1', priceOverride: '' }],
      }).success,
    ).toBe(false);
  });
});
