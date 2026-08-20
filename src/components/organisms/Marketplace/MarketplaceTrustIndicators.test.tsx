import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { MarketplaceTrustIndicators } from './MarketplaceTrustIndicators';

describe('MarketplaceTrustIndicators', () => {
  it('labels marketplace facts separately from seller-declared copy', () => {
    render(
      <MarketplaceTrustIndicators
        shop={{
          name: 'Satoshi Vintage',
          bio: 'Used denim and boots.',
          location: { countryCode: 'US', region: 'NY' },
          shippingPolicy: 'Ships in three days.',
          returnPolicy: '30-day returns.',
          vacationMode: false,
        }}
        reputation={{
          salesCount: 4,
          reviewCount: 2,
          averageRating: 4.5,
          responseTimeHours: 6,
          itemAccuracy: null,
          shipping: null,
          communication: null,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Trust indicators' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verified by marketplace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Self-declared by seller' })).toBeInTheDocument();
    expect(screen.getByText('4 completed')).toBeInTheDocument();
    expect(screen.getByText('Satoshi Vintage')).toBeInTheDocument();
    expect(screen.getByText('Off (seller-declared)')).toBeInTheDocument();
  });

  it('has no serious or critical automated violations', async () => {
    const { container } = render(<MarketplaceTrustIndicators shop={null} reputation={null} />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
