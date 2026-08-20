'use client';

import { Badge } from '@/atoms/Badge/Badge';
import { Typography } from '@/atoms/Typography/Typography';
import type { CommerceShopRecord } from '@/libs/commerce/marketplace-records';
import { marketplaceTrustFacts } from '@/libs/commerce/trust-indicators';
import type { MarketplaceSellerReputation } from '@/services/marketplace/marketplace';

export function MarketplaceTrustIndicators({
  shop,
  reputation,
  listingRevision,
}: {
  shop?: Pick<
    CommerceShopRecord,
    'name' | 'bio' | 'location' | 'shippingPolicy' | 'returnPolicy' | 'vacationMode'
  > | null;
  reputation?: Pick<
    MarketplaceSellerReputation,
    'salesCount' | 'reviewCount' | 'averageRating' | 'responseTimeHours' | 'itemAccuracy' | 'shipping' | 'communication'
  > | null;
  listingRevision?: number;
}) {
  const facts = marketplaceTrustFacts({ shop, reputation, listingRevision });

  return (
    <section aria-labelledby="marketplace-trust-heading" className="rounded-xl border bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Typography as="h2" id="marketplace-trust-heading" className="text-sm font-semibold">
          Trust indicators
        </Typography>
        <Badge variant="outline">Verified facts vs seller copy</Badge>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Typography as="h3" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Verified by marketplace
          </Typography>
          <div className="mt-2 grid gap-2">
            {facts.verified.map((fact) => (
              <div key={fact.label}>
                <Typography as="p" className="text-xs text-muted-foreground">
                  {fact.label}
                </Typography>
                <Typography as="p" className="text-sm">
                  {fact.value}
                </Typography>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Typography as="h3" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Self-declared by seller
          </Typography>
          <div className="mt-2 grid gap-2">
            {facts.selfDeclared.map((fact) => (
              <div key={fact.label}>
                <Typography as="p" className="text-xs text-muted-foreground">
                  {fact.label}
                </Typography>
                <Typography as="p" className="text-sm">
                  {fact.value}
                </Typography>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
