'use client';

import { Typography } from '@/atoms/Typography/Typography';
import {
  marketplaceAuctionStanding,
  marketplaceAuctionStandingCopy,
  marketplaceMinimumNextBid,
} from '@/libs/commerce/auction-status';
import { formatCommerceDateTime, formatCommerceMoney } from '@/libs/commerce/format';
import type { CommerceListingRecord } from '@/libs/commerce/marketplace-records';
import type { MarketplaceListingProjection } from '@/services/marketplace/marketplace';

export function MarketplaceAuctionStatus({
  fallback,
  auction,
  history,
  currentUserPubky,
}: {
  fallback: Extract<CommerceListingRecord['sale'], { format: 'auction' }>;
  auction: MarketplaceListingProjection['auction'] | null;
  history: NonNullable<MarketplaceListingProjection['visibleBidHistory']>;
  currentUserPubky: string | null;
}) {
  const currentPrice = auction?.currentPrice ?? fallback.startingPrice;
  const increment = auction?.minimumIncrement ?? fallback.minimumIncrement;
  const minimumNextBid = auction?.minimumNextBid ?? marketplaceMinimumNextBid(currentPrice);
  const endsAt = auction?.endsAt ?? fallback.endsAt;
  const bidCount = auction?.bidCount ?? 0;
  const reserveMet = auction?.reserveMet ?? false;
  const standing = marketplaceAuctionStanding(
    currentUserPubky,
    auction?.leaderPubky,
    history.map((bid) => bid.bidderPubky),
  );

  return (
    <section aria-labelledby="marketplace-auction-status-heading" className="rounded-xl border bg-card/60 p-4">
      <Typography as="h2" id="marketplace-auction-status-heading" className="text-sm font-semibold">
        Auction status
      </Typography>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Typography as="p" className="text-xs text-muted-foreground">
            Bids
          </Typography>
          <Typography as="p" className="text-sm font-semibold">
            {bidCount} {bidCount === 1 ? 'bid' : 'bids'} · {reserveMet ? 'Reserve met' : 'Reserve not met'}
          </Typography>
        </div>
        <div>
          <Typography as="p" className="text-xs text-muted-foreground">
            Minimum next bid
          </Typography>
          <Typography as="p" className="text-sm font-semibold">
            {formatCommerceMoney(minimumNextBid)}
          </Typography>
        </div>
        <div>
          <Typography as="p" className="text-xs text-muted-foreground">
            Increment
          </Typography>
          <Typography as="p" className="text-sm font-semibold">
            {formatCommerceMoney(increment)}
          </Typography>
        </div>
        <div>
          <Typography as="p" className="text-xs text-muted-foreground">
            Ends
          </Typography>
          <Typography as="p" className="text-sm font-semibold">
            {formatCommerceDateTime(endsAt)}
          </Typography>
        </div>
        <div className="sm:col-span-2">
          <Typography as="p" className="text-xs text-muted-foreground">
            Your standing
          </Typography>
          <Typography as="p" role="status" className="text-sm font-semibold">
            {marketplaceAuctionStandingCopy(standing)}
          </Typography>
        </div>
      </div>
    </section>
  );
}
