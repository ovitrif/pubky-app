'use client';

import { Typography } from '@/atoms/Typography/Typography';
import { formatCommerceMoney } from '@/libs/commerce/format';
import type { MarketplaceListingProjection } from '@/services/marketplace/marketplace';

export function MarketplaceBidHistory({
  history,
}: {
  history: NonNullable<MarketplaceListingProjection['visibleBidHistory']>;
}) {
  return (
    <section aria-labelledby="marketplace-bid-history-heading" className="rounded-xl border bg-card/60 p-4">
      <Typography as="h2" id="marketplace-bid-history-heading" className="text-sm font-semibold">
        Bid history
      </Typography>
      <Typography as="p" className="mt-1 text-xs text-muted-foreground">
        Visible prices only. Proxy maximums stay private.
      </Typography>
      {history.length === 0 ? (
        <Typography as="p" className="mt-3 text-sm text-muted-foreground">
          No bids yet
        </Typography>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {history.map((bid) => (
            <li key={`${bid.sequence}-${bid.bidderPubky}`} className="flex items-center justify-between gap-3 text-sm">
              <Typography as="span" className="text-muted-foreground">
                Bid {bid.sequence} · {bid.bidderPubky.slice(0, 8)}…
              </Typography>
              <Typography as="span" className="font-semibold">
                {formatCommerceMoney(bid.visiblePrice)}
              </Typography>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
