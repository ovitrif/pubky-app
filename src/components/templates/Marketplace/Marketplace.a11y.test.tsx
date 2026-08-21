import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Marketplace } from './Marketplace';

const fixtures = vi.hoisted(async () => {
  const { createCommerceSandboxCatalog } = await import('@/libs/commerce/sandbox-catalog');
  const catalog = createCommerceSandboxCatalog();
  const listings = catalog.listings.map((record) => {
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
      sync_status: 'synced' as const,
      updated_at: Date.parse(record.updatedAt),
    };
  });
  return {
    listings,
    shopsBySeller: new Map(catalog.shops.map((shop) => [shop.ownerPubky, shop])),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/marketplace',
}));

vi.mock('@/hooks/useRequireAuth/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: (action: () => void) => action() }),
}));

vi.mock('@/hooks/useRecentlyViewedListings/useRecentlyViewedListings', () => ({
  useRecentlyViewedListings: () => [],
}));

vi.mock('@/hooks/useMarketplaceSavedSearches/useMarketplaceSavedSearches', () => ({
  useMarketplaceSavedSearches: () => ({
    searches: [],
    save: vi.fn(),
    apply: vi.fn(),
    remove: vi.fn(),
    canSave: false,
  }),
}));

vi.mock('@/hooks/useMarketplaceCatalog/useMarketplaceCatalog', async () => {
  const catalog = await fixtures;
  const listings = catalog.listings.slice(0, 4);
  return {
    useMarketplaceCatalog: () => ({
      listings,
      shopsBySeller: catalog.shopsBySeller,
      sections: null,
      showFeedSections: false,
      isLoading: false,
      initializationError: null,
      adapterMode: 'sandbox',
    }),
  };
});

vi.mock('@/organisms/ContentLayout/ContentLayout', () => ({
  ContentLayout: ({ children }: { children: ReactNode }) => <main className="w-full py-6">{children}</main>,
}));

describe('Marketplace catalog accessibility', () => {
  it('has no serious or critical automated violations on the sandbox catalog', async () => {
    const { container } = render(<Marketplace />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  }, 10_000);
});
