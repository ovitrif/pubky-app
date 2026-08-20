import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MARKETPLACE_SANDBOX_BIDDER_A } from '@/libs/commerce/sandbox-actors';
import { MarketplaceAuctionStatus } from './MarketplaceAuctionStatus';

const fallback = {
  format: 'auction' as const,
  startingPrice: { amountMinor: 4_500, currency: 'USD', exponent: 2 },
  reservePrice: { amountMinor: 6_500, currency: 'USD', exponent: 2 },
  buyNowPrice: { amountMinor: 12_500, currency: 'USD', exponent: 2 },
  minimumIncrement: { amountMinor: 500, currency: 'USD', exponent: 2 },
  startsAt: '2026-08-19T20:00:00.000Z',
  endsAt: '2026-08-29T20:00:00.000Z',
  antiSnipingWindowSeconds: 120,
  antiSnipingExtensionSeconds: 120,
};

describe('MarketplaceAuctionStatus', () => {
  it('shows minimum next bid, end time, and signed-out standing', () => {
    render(
      <MarketplaceAuctionStatus
        fallback={fallback}
        auction={{
          startsAt: fallback.startsAt,
          endsAt: fallback.endsAt,
          minimumIncrement: fallback.minimumIncrement,
          currentPrice: { amountMinor: 8_000, currency: 'USD', exponent: 2 },
          minimumNextBid: { amountMinor: 8_001, currency: 'USD', exponent: 2 },
          leaderPubky: MARKETPLACE_SANDBOX_BIDDER_A,
          bidCount: 2,
          reserveMet: true,
        }}
        history={[
          {
            sequence: 1,
            bidderPubky: MARKETPLACE_SANDBOX_BIDDER_A,
            visiblePrice: { amountMinor: 4_500, currency: 'USD', exponent: 2 },
            createdAt: '2026-08-19T22:00:00.000Z',
          },
        ]}
        currentUserPubky={null}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Auction status' })).toBeInTheDocument();
    expect(screen.getByText('2 bids · Reserve met')).toBeInTheDocument();
    expect(screen.getByText('$80.01')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText(/Aug 29, 2026/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Sign in to see your standing');
  });

  it('reports high-bidder standing without exposing a proxy maximum', () => {
    const { container } = render(
      <MarketplaceAuctionStatus
        fallback={fallback}
        auction={{
          startsAt: fallback.startsAt,
          endsAt: fallback.endsAt,
          minimumIncrement: fallback.minimumIncrement,
          currentPrice: fallback.startingPrice,
          leaderPubky: MARKETPLACE_SANDBOX_BIDDER_A,
          bidCount: 1,
          reserveMet: false,
        }}
        history={[]}
        currentUserPubky={MARKETPLACE_SANDBOX_BIDDER_A}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('You are the high bidder');
    expect(container.textContent).not.toContain('maximumAmount');
  });
});
