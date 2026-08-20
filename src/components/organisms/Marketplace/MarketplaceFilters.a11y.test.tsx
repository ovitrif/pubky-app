import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceFilters } from './MarketplaceFilters';

vi.mock('@/hooks/useMarketplaceSavedSearches/useMarketplaceSavedSearches', () => ({
  useMarketplaceSavedSearches: () => ({
    searches: [],
    save: vi.fn(),
    remove: vi.fn(),
    apply: vi.fn(),
    canSave: false,
  }),
}));

describe('MarketplaceFilters accessibility', () => {
  it('has no serious or critical automated violations', async () => {
    const { container } = render(<MarketplaceFilters resultCount={10} />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
