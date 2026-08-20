import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceCart } from './MarketplaceCart';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/marketplace/cart',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/useMarketplaceCart/useMarketplaceCart', () => ({
  useMarketplaceCart: () => ({
    items: [],
    itemCount: 0,
    subtotalMinor: 0,
    isLoading: false,
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRequireAuth/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: vi.fn() }),
}));

describe('MarketplaceCart accessibility', () => {
  it('has no serious or critical automated violations on the empty cart', async () => {
    const { container } = render(<MarketplaceCart />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
