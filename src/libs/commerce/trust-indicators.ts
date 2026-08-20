import type { CommerceShopRecord } from '@/libs/commerce/marketplace-records';
import type { MarketplaceSellerReputation } from '@/services/marketplace/marketplace';

export interface MarketplaceTrustFact {
  label: string;
  value: string;
}

export interface MarketplaceTrustFacts {
  verified: MarketplaceTrustFact[];
  selfDeclared: MarketplaceTrustFact[];
}

export function marketplaceTrustFacts({
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
}): MarketplaceTrustFacts {
  const location = shop?.location
    ? `${shop.location.region ? `${shop.location.region}, ` : ''}${shop.location.countryCode}`
    : null;

  return {
    verified: [
      { label: 'Identity', value: 'Owner-signed Pubky shop and listings' },
      {
        label: 'Sales',
        value: reputation ? `${reputation.salesCount} completed` : 'No marketplace sales yet',
      },
      {
        label: 'Reviews',
        value: reputation
          ? `${reputation.averageRating ?? '—'} average · ${reputation.reviewCount} reviews`
          : 'No completed-transaction reviews yet',
      },
      ...(reputation?.itemAccuracy != null ? [{ label: 'Item accuracy', value: `${reputation.itemAccuracy}` }] : []),
      ...(reputation?.shipping != null ? [{ label: 'Shipping rating', value: `${reputation.shipping}` }] : []),
      ...(reputation?.communication != null ? [{ label: 'Communication', value: `${reputation.communication}` }] : []),
      {
        label: 'Response time',
        value:
          reputation?.responseTimeHours != null
            ? `${reputation.responseTimeHours} hours`
            : 'Not enough completed conversations',
      },
      ...(listingRevision != null ? [{ label: 'Listing revision', value: String(listingRevision) }] : []),
    ],
    selfDeclared: [
      { label: 'Shop name', value: shop?.name?.trim() || 'Not published' },
      { label: 'Bio', value: shop?.bio?.trim() || 'Not published' },
      { label: 'Location', value: location || 'Not published' },
      { label: 'Vacation mode', value: shop?.vacationMode ? 'On (seller-declared)' : 'Off (seller-declared)' },
      { label: 'Shipping policy', value: shop?.shippingPolicy?.trim() || 'Not published' },
      { label: 'Return policy', value: shop?.returnPolicy?.trim() || 'Not published' },
    ],
  };
}
