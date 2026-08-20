'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Bell, Heart, MapPin, ShieldCheck, ShoppingCart, Store } from 'lucide-react';
import { APP_ROUTES, getMarketplaceShopRoute } from '@/app/routes';
import { Badge } from '@/atoms/Badge/Badge';
import { Button } from '@/atoms/Button/Button';
import { Card, CardContent } from '@/atoms/Card/Card';
import { Container } from '@/atoms/Container/Container';
import { Heading } from '@/atoms/Heading/Heading';
import { Link } from '@/atoms/Link/Link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/atoms/Select/Select';
import { Typography } from '@/atoms/Typography/Typography';
import { getCommerceAdapterMode } from '@/config/commerce';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useCommerceFavorite } from '@/hooks/useCommerceFavorite/useCommerceFavorite';
import { useMarketplaceBuyNow } from '@/hooks/useMarketplaceBuyNow/useMarketplaceBuyNow';
import { useMarketplaceCart } from '@/hooks/useMarketplaceCart/useMarketplaceCart';
import { relatedMarketplaceListings } from '@/hooks/useMarketplaceCatalog/useMarketplaceCatalog.utils';
import { useMarketplaceProjection } from '@/hooks/useMarketplaceProjection/useMarketplaceProjection';
import { useRecordRecentlyViewedListing } from '@/hooks/useRecentlyViewedListings/useRecentlyViewedListings';
import { formatCommerceCondition, formatCommerceMoney } from '@/libs/commerce/format';
import { commerceListingSalePrice } from '@/libs/commerce/marketplace-records';
import { quoteSandboxListingShippingMinor, resolveListingFulfillmentMethod } from '@/libs/commerce/tax-adapter';
import { buildMarketplaceListingAggregateId } from '@/libs/commerce/transaction-commands';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';
import { MarketplaceAuctionStatus } from '@/organisms/Marketplace/MarketplaceAuctionStatus';
import { MarketplaceBidDialog } from '@/organisms/Marketplace/MarketplaceBidDialog';
import { MarketplaceBidHistory } from '@/organisms/Marketplace/MarketplaceBidHistory';
import { MarketplaceListingCard } from '@/organisms/Marketplace/MarketplaceListingCard';
import { MarketplaceListingGallery } from '@/organisms/Marketplace/MarketplaceListingGallery';
import { MarketplaceListingShare } from '@/organisms/Marketplace/MarketplaceListingShare';
import { MarketplaceLocksPayment } from '@/organisms/Marketplace/MarketplaceLocksPayment';
import { MarketplaceMessageDialog } from '@/organisms/Marketplace/MarketplaceMessageDialog';
import { MarketplaceOfferDialog } from '@/organisms/Marketplace/MarketplaceOfferDialog';
import { MarketplaceQuantityStepper } from '@/organisms/Marketplace/MarketplaceQuantityStepper';
import { MarketplaceReportDialog } from '@/organisms/Marketplace/MarketplaceReportDialog';
import { MarketplaceSellerPolicies } from '@/organisms/Marketplace/MarketplaceSellerPolicies';
import { MarketplaceVacationNotice } from '@/organisms/Marketplace/MarketplaceVacationNotice';
import type { MarketplaceSellerReputation } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';
import { MarketplaceSkeleton } from './Marketplace.skeleton';

export interface MarketplaceListingProps {
  sellerPubky: string;
  listingId: string;
}

export function MarketplaceListing({ sellerPubky, listingId }: MarketplaceListingProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reputation, setReputation] = useState<MarketplaceSellerReputation | null>(null);
  const adapterMode = getCommerceAdapterMode();
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const favorite = useCommerceFavorite(`${sellerPubky}:${listingId}`);
  const negotiation = useMarketplaceProjection(sellerPubky, listingId);
  const cart = useMarketplaceCart();
  const aggregateId = buildMarketplaceListingAggregateId(sellerPubky, listingId);
  const buyNow = useMarketplaceBuyNow(aggregateId, negotiation.projection?.serverRevision ?? null);
  useRecordRecentlyViewedListing(sellerPubky, listingId);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await CommerceController.initializeSandboxCatalog();
      if (adapterMode !== 'sandbox') {
        await CommerceController.getOrFetchListing(sellerPubky, listingId);
      }
    };
    initialize().catch(() => {
      if (active) setError('This listing could not be loaded.');
    });
    CommerceController.getSellerReputation(sellerPubky)
      .then((next) => {
        if (active) setReputation(next);
      })
      .catch(() => {
        if (active) setReputation(null);
      });
    return () => {
      active = false;
    };
  }, [adapterMode, listingId, sellerPubky]);

  const listing = useLiveQuery(() => CommerceController.getListing(sellerPubky, listingId), [sellerPubky, listingId]);
  const shop = useLiveQuery(() => CommerceController.getShop(sellerPubky), [sellerPubky]);
  const catalogListings = useLiveQuery(() => CommerceController.getAllListings(), []);

  useEffect(() => {
    const firstVariant = listing?.record.variants[0]?.id;
    if (firstVariant && !listing?.record.variants.some(({ id }) => id === selectedVariantId)) {
      setSelectedVariantId(firstVariant);
    }
  }, [listing, selectedVariantId]);

  useEffect(() => {
    setQuantity(1);
  }, [selectedVariantId]);

  if (listing === undefined || shop === undefined) {
    return (
      <ContentLayout
        showLeftSidebar={false}
        showRightSidebar={false}
        showLeftMobileButton={false}
        showRightMobileButton={false}
      >
        <Container overrideDefaults className="w-full px-4 sm:px-6">
          <MarketplaceSkeleton count={1} />
        </Container>
      </ContentLayout>
    );
  }

  if (!listing || error) {
    return (
      <ContentLayout
        showLeftSidebar={false}
        showRightSidebar={false}
        showLeftMobileButton={false}
        showRightMobileButton={false}
      >
        <Container className="min-h-96 items-center justify-center px-6 text-center">
          <Store className="mb-4 size-12 text-muted-foreground" />
          <Heading level={1} size="lg">
            Listing unavailable
          </Heading>
          <Typography as="p" className="mt-2 text-muted-foreground">
            {error ?? 'This listing is no longer in the local marketplace catalog.'}
          </Typography>
          <Button asChild className="mt-6 rounded-full">
            <Link href={APP_ROUTES.MARKETPLACE} overrideDefaults>
              Back to marketplace
            </Link>
          </Button>
        </Container>
      </ContentLayout>
    );
  }

  const record = listing.record;
  const selectedVariant = record.variants.find(({ id }) => id === selectedVariantId) ?? record.variants[0];
  const price = commerceListingSalePrice(record.sale);
  const displayPrice = negotiation.projection?.auction?.currentPrice ?? price;
  const fulfillment = resolveListingFulfillmentMethod(record.fulfillmentMethods);
  const shippingMinor = quoteSandboxListingShippingMinor({
    fulfillment,
    shippingOptions: record.shippingOptions,
    packageWeightGrams: record.package?.weightGrams,
  });
  const shippingLabel =
    fulfillment === 'digital'
      ? 'Digital delivery · no shipping'
      : shippingMinor === 0
        ? 'Free shipping'
        : `Quoted shipping ${formatCommerceMoney({ amountMinor: shippingMinor, currency: 'USD', exponent: 2 })}`;

  return (
    <ContentLayout
      showLeftSidebar={false}
      showRightSidebar={false}
      showLeftMobileButton={false}
      showRightMobileButton={false}
      className="pb-28 lg:pb-16"
      classNameWrapperContent="max-w-6xl"
    >
      <Container overrideDefaults className="flex w-full flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href={APP_ROUTES.MARKETPLACE}
          overrideDefaults
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Marketplace
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <MarketplaceListingGallery media={record.media} saleFormat={record.sale.format} />

          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{formatCommerceCondition(record.condition)}</Badge>
                {adapterMode === 'sandbox' && <Badge variant="outline">Sandbox · no real funds</Badge>}
              </div>
              <Heading level={1} size="xl" className="text-3xl leading-tight sm:text-5xl">
                {record.title}
              </Heading>
              <Typography as="p" className="mt-3 text-3xl font-bold text-brand">
                {record.sale.format === 'auction'
                  ? negotiation.projection?.auction?.bidCount
                    ? 'Current bid '
                    : 'Starting at '
                  : record.sale.format === 'offer'
                    ? 'Asking '
                    : ''}
                {formatCommerceMoney(displayPrice)}
              </Typography>
              {record.sale.format !== 'auction' && record.sale.autoAcceptAmount && (
                <Typography as="p" className="mt-2 text-sm text-muted-foreground">
                  Seller auto-accepts offers at or above {formatCommerceMoney(record.sale.autoAcceptAmount)}.
                </Typography>
              )}
            </div>

            {shop?.record.vacationMode && <MarketplaceVacationNotice />}
            {record.sale.format === 'auction' && (
              <MarketplaceAuctionStatus
                fallback={record.sale}
                auction={negotiation.projection?.auction ?? null}
                history={negotiation.projection?.visibleBidHistory ?? []}
                currentUserPubky={currentUserPubky}
              />
            )}

            <Card className="gap-4 border py-5">
              <CardContent className="flex items-center justify-between gap-4 px-5">
                <div>
                  <Typography as="p" className="text-sm text-muted-foreground">
                    Sold by
                  </Typography>
                  <Typography as="p" className="font-semibold">
                    {shop?.record.name ?? `${sellerPubky.slice(0, 10)}…`}
                  </Typography>
                  <Typography as="p" className="mt-1 text-xs text-muted-foreground">
                    {reputation
                      ? `${reputation.averageRating ?? '—'} · ${reputation.reviewCount} reviews · ${reputation.salesCount} sales`
                      : 'Owner-signed shop'}
                  </Typography>
                </div>
                <Button asChild variant="secondary" size="sm" className="rounded-full">
                  <Link href={getMarketplaceShopRoute(sellerPubky)} overrideDefaults>
                    View shop
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-2">
              <MarketplaceMessageDialog sellerPubky={sellerPubky} listingId={listingId} />
              <MarketplaceReportDialog targetId={aggregateId} />
              <MarketplaceListingShare title={record.title} />
            </div>

            <Typography as="p" className="text-base leading-7 text-muted-foreground">
              {record.description}
            </Typography>
            <Typography as="p" className="text-sm text-muted-foreground">
              {selectedVariant ? `${selectedVariant.quantity} available` : 'Unavailable'}
            </Typography>
            {record.sale.format === 'fixed_price' && selectedVariant && (
              <div>
                <Typography as="p" className="mb-2 text-sm font-semibold">
                  Quantity
                </Typography>
                <MarketplaceQuantityStepper
                  value={Math.min(quantity, selectedVariant.quantity)}
                  max={selectedVariant.quantity}
                  label={record.title}
                  onChange={setQuantity}
                />
              </div>
            )}
            <MarketplaceSellerPolicies
              shop={shop?.record}
              listingReturn={record.returnPolicy}
              listingShipping={shippingLabel}
            />

            <div className="flex flex-wrap gap-2">
              {record.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>

            {record.variants.length > 1 && (
              <div>
                <Typography as="p" className="mb-2 text-sm font-semibold">
                  Variant
                </Typography>
                <Select value={selectedVariant?.id} onValueChange={setSelectedVariantId}>
                  <SelectTrigger className="h-11 w-full rounded-md border px-3" aria-label="Choose listing variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {record.variants.map((variant) => (
                      <SelectItem
                        key={variant.id}
                        value={variant.id}
                        disabled={!variant.enabled || variant.quantity === 0}
                      >
                        {Object.values(variant.options).join(' · ') || variant.sku || 'Default'} · {variant.quantity}{' '}
                        left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <MapPin className="size-5 text-brand" />
                <div>
                  <Typography as="p" className="text-sm font-semibold">
                    {record.fulfillmentMethods.includes('digital') ? 'Digital delivery' : 'Ships from'}
                  </Typography>
                  <Typography as="p" className="text-sm text-muted-foreground">
                    {record.fulfillmentMethods.includes('digital')
                      ? 'Locks credential after payment'
                      : `${shippingLabel} · ${record.location.region ? `${record.location.region}, ` : ''}${record.location.countryCode}`}
                  </Typography>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <ShieldCheck className="size-5 text-brand" />
                <div>
                  <Typography as="p" className="text-sm font-semibold">
                    Owner-signed
                  </Typography>
                  <Typography as="p" className="text-sm text-muted-foreground">
                    Revision {record.revision}
                  </Typography>
                </div>
              </div>
            </div>

            {record.digitalLock && (
              <MarketplaceLocksPayment
                creatorPubky={record.ownerPubky}
                lockResource={record.digitalLock.policyUri}
                criterionId={record.digitalLock.criterionId}
              />
            )}

            {record.sale.format === 'auction' && (
              <MarketplaceBidHistory history={negotiation.projection?.visibleBidHistory ?? []} />
            )}

            <div className="mt-auto flex gap-3">
              {record.sale.format === 'auction' ? (
                <>
                  <MarketplaceBidDialog
                    aggregateId={aggregateId}
                    projection={negotiation.projection}
                    onAccepted={negotiation.refresh}
                  />
                  {record.sale.buyNowPrice && currentUserPubky !== sellerPubky && (
                    <Button
                      size="lg"
                      variant="secondary"
                      className="rounded-full"
                      disabled={negotiation.projection?.serverRevision == null}
                      onClick={() => {
                        void buyNow.submit().then((ok) => {
                          if (ok) void negotiation.refresh();
                        });
                      }}
                    >
                      Buy now {formatCommerceMoney(record.sale.buyNowPrice)}
                    </Button>
                  )}
                  {currentUserPubky === sellerPubky && (
                    <MarketplaceOfferDialog
                      aggregateId={aggregateId}
                      expectedRevision={negotiation.projection?.serverRevision ?? null}
                      onAccepted={negotiation.refresh}
                      asSeller
                      label="Offer to watcher"
                    />
                  )}
                </>
              ) : record.sale.format === 'offer' ? (
                <>
                  <MarketplaceOfferDialog
                    aggregateId={aggregateId}
                    expectedRevision={negotiation.projection?.serverRevision ?? null}
                    onAccepted={negotiation.refresh}
                    asSeller={currentUserPubky === sellerPubky}
                    label={
                      currentUserPubky === sellerPubky
                        ? 'Offer to watcher'
                        : favorite.isFavorite
                          ? 'Make offer'
                          : 'Watch to offer'
                    }
                    disabled={currentUserPubky !== sellerPubky && !favorite.isFavorite}
                  />
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="flex-1 rounded-full"
                    disabled={adapterMode === 'unavailable' || !selectedVariant || selectedVariant.quantity === 0}
                    onClick={() =>
                      selectedVariant &&
                      void cart.add(
                        `${record.ownerPubky}:${record.listingId}`,
                        selectedVariant.id,
                        Math.min(quantity, selectedVariant.quantity),
                      )
                    }
                  >
                    <ShoppingCart className="mr-2 size-4" />
                    Add to cart
                  </Button>
                  {record.sale.acceptsOffers && (
                    <MarketplaceOfferDialog
                      aggregateId={aggregateId}
                      expectedRevision={negotiation.projection?.serverRevision ?? null}
                      onAccepted={negotiation.refresh}
                    />
                  )}
                </>
              )}
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full"
                aria-label={
                  record.sale.format === 'fixed_price'
                    ? favorite.isFavorite
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                    : favorite.isFavorite
                      ? 'Remove from watchlist'
                      : 'Add to watchlist'
                }
                aria-pressed={favorite.isFavorite}
                disabled={favorite.isMutating}
                onClick={favorite.toggle}
              >
                {record.sale.format === 'fixed_price' ? (
                  <Heart className={favorite.isFavorite ? 'fill-brand text-brand' : ''} />
                ) : (
                  <Bell className={favorite.isFavorite ? 'fill-brand text-brand' : ''} />
                )}
              </Button>
            </div>
            {record.sale.format === 'offer' && (
              <Typography as="p" className="text-center text-sm text-muted-foreground">
                Watcher-only offer. Add this listing to your watchlist to send a private offer. There is no buy-now
                checkout.
              </Typography>
            )}
            {adapterMode === 'unavailable' && (
              <Typography as="p" className="text-center text-sm text-muted-foreground">
                Transactions are disabled in this deployment.
              </Typography>
            )}
            {adapterMode === 'sandbox' && negotiation.error && (
              <Typography as="p" className="text-center text-sm text-amber-300">
                {negotiation.error}
              </Typography>
            )}
          </div>
        </div>
        {listing && catalogListings && relatedMarketplaceListings(catalogListings, listing).length > 0 && (
          <section className="flex flex-col gap-4">
            <Heading level={2} size="md">
              Related items
            </Heading>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {relatedMarketplaceListings(catalogListings, listing).map((related) => (
                <MarketplaceListingCard key={related.id} listing={related} shopName={shop?.record.name} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </ContentLayout>
  );
}
