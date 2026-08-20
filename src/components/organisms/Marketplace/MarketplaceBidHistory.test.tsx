import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketplaceBidHistory } from './MarketplaceBidHistory';

describe('MarketplaceBidHistory', () => {
  it('announces an empty public bid history', () => {
    render(<MarketplaceBidHistory history={[]} />);

    expect(screen.getByRole('heading', { name: 'Bid history' })).toBeInTheDocument();
    expect(screen.getByText('No bids yet')).toBeInTheDocument();
    expect(screen.getByText(/Proxy maximums stay private/)).toBeInTheDocument();
  });

  it('renders visible prices without exposing a proxy maximum', () => {
    const { container } = render(
      <MarketplaceBidHistory
        history={[
          {
            sequence: 1,
            bidderPubky: 'b'.repeat(52),
            visiblePrice: { amountMinor: 4_500, currency: 'USD', exponent: 2 },
            createdAt: '2026-08-19T22:00:00.000Z',
          },
          {
            sequence: 2,
            bidderPubky: 'n'.repeat(52),
            visiblePrice: { amountMinor: 6_000, currency: 'USD', exponent: 2 },
            createdAt: '2026-08-19T22:01:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('$45.00')).toBeInTheDocument();
    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(container.textContent).not.toContain('maximumAmount');
    expect(container.textContent).not.toContain('20000');
  });
});
