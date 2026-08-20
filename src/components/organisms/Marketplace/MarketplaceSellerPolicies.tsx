'use client';

import { Typography } from '@/atoms/Typography/Typography';
import type { CommerceListingRecord, CommerceShopRecord } from '@/libs/commerce/marketplace-records';
import { MarketplaceGuaranteeTerms } from '@/organisms/Marketplace/MarketplaceGuaranteeTerms';

export function MarketplaceSellerPolicies({
  shop,
  listingReturn,
  listingShipping,
}: {
  shop?: Pick<CommerceShopRecord, 'shippingPolicy' | 'returnPolicy'> | null;
  listingReturn?: CommerceListingRecord['returnPolicy'];
  listingShipping?: string;
}) {
  return (
    <section aria-labelledby="marketplace-policies-heading" className="rounded-xl border bg-card/60 p-4">
      <Typography as="h2" id="marketplace-policies-heading" className="text-sm font-semibold">
        Buying policies
      </Typography>
      <div className="mt-3 flex flex-col gap-3">
        {(listingShipping || shop?.shippingPolicy) && (
          <div>
            <Typography as="p" className="text-xs text-muted-foreground">
              Shipping
            </Typography>
            {listingShipping && (
              <Typography as="p" className="text-sm">
                {listingShipping}
              </Typography>
            )}
            {shop?.shippingPolicy && (
              <Typography as="p" className="text-sm">
                {shop.shippingPolicy}
              </Typography>
            )}
          </div>
        )}
        <div>
          <Typography as="p" className="text-xs text-muted-foreground">
            Returns
          </Typography>
          <Typography as="p" className="text-sm">
            {listingReturn
              ? listingReturn.acceptsReturns
                ? `Returns accepted within ${listingReturn.returnWindowDays} days.${
                    listingReturn.buyerPaysReturnShipping ? ' Buyer pays return shipping.' : ''
                  }`
                : 'This listing does not accept returns.'
              : (shop?.returnPolicy ?? 'Seller has not published a return policy.')}
          </Typography>
        </div>
        {shop?.returnPolicy && listingReturn && (
          <div>
            <Typography as="p" className="text-xs text-muted-foreground">
              Shop policy
            </Typography>
            <Typography as="p" className="text-sm">
              {shop.returnPolicy}
            </Typography>
          </div>
        )}
        <MarketplaceGuaranteeTerms />
      </div>
    </section>
  );
}
