'use client';

import { APP_ROUTES, getMarketplaceListingRoute } from '@/app/routes';
import { Badge } from '@/atoms/Badge/Badge';
import { Link } from '@/atoms/Link/Link';
import { Typography } from '@/atoms/Typography/Typography';
import type { MarketplaceConversation } from '@/services/marketplace/marketplace';

type Message = MarketplaceConversation['messages'][number];

export function MarketplaceMessageCard({ message }: { message: Message }) {
  const card = message.card;
  if (!card) return null;
  const href =
    card.sellerPubky && card.listingId
      ? getMarketplaceListingRoute(card.sellerPubky, card.listingId)
      : APP_ROUTES.MARKETPLACE;
  const amount =
    card.offerAmountMinor != null && card.offerCurrency
      ? `${(card.offerAmountMinor / 100).toFixed(2)} ${card.offerCurrency}`
      : null;

  return (
    <Link
      href={href}
      overrideDefaults
      className="mt-2 block rounded-xl border bg-background/70 p-3 text-left no-underline"
    >
      <Badge variant="outline">{card.type === 'offer' ? 'Offer card' : 'Listing card'}</Badge>
      <Typography as="p" className="mt-2 font-semibold">
        {card.listingTitle}
      </Typography>
      {amount && (
        <Typography as="p" className="text-sm text-muted-foreground">
          {amount}
          {card.offerState ? ` · ${card.offerState.replaceAll('_', ' ')}` : ''}
        </Typography>
      )}
    </Link>
  );
}
