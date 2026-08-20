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
import { formatCommerceCondition, formatCommerceMoney } from '@/libs/commerce/format';
import { buildMarketplaceListingAggregateId } from '@/libs/commerce/transaction-commands';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';
import { MarketplaceBidDialog } from '@/organisms/Marketplace/MarketplaceBidDialog';
import { MarketplaceListingCard } from '@/organisms/Marketplace/MarketplaceListingCard';
import { MarketplaceListingGallery } from '@/organisms/Marketplace/MarketplaceListingGallery';
import { MarketplaceLocksPayment } from '@/organisms/Marketplace/MarketplaceLocksPayment';
import { MarketplaceMessageDialog } from '@/organisms/Marketplace/MarketplaceMessageDialog';
import { MarketplaceOfferDialog } from '@/organisms/Marketplace/MarketplaceOfferDialog';
import { MarketplaceReportDialog } from '@/organisms/Marketplace/MarketplaceReportDialog';
import { useAuthStore } from '@/stores/auth/auth.store';
import { MarketplaceSkeleton } from './Marketplace.skeleton';

export interface MarketplaceListingProps {
  sellerPubky: string;
  listingId: string;
}

export function MarketplaceListing({ sellerPubky, listingId }: MarketplaceListingProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const adapterMode = getCommerceAdapterMode();
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const favorite = useCommerceFavorite(`${sellerPubky}:${listingId}`);
  const negotiation = useMarketplaceProjection(sellerPubky, listingId);
  const cart = useMarketplaceCart();
  const aggregateId = buildMarketplaceListingAggregateId(sellerPubky, listingId);
  const buyNow = useMarketplaceBuyNow(aggregateId, negotiation.projection?.serverRevision ?? null);

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
  const price = record.sale.format === 'fixed_price' ? record.sale.unitPrice : record.sale.startingPrice;
  const displayPrice = negotiation.projection?.auction?.currentPrice ?? price;

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
                  : ''}
                {formatCommerceMoney(displayPrice)}
              </Typography>
              {negotiation.projection?.auction && (
                <Typography as="p" className="mt-1 text-sm text-muted-foreground">
                  {negotiation.projection.auction.bidCount}{' '}
                  {negotiation.projection.auction.bidCount === 1 ? 'bid' : 'bids'} ·{' '}
                  {negotiation.projection.auction.reserveMet ? 'Reserve met' : 'Reserve not met'}
                </Typography>
              )}
            </div>

            <Card className="gap-4 border py-5">
              <CardContent className="flex items-center justify-between gap-4 px-5">
                <div>
                  <Typography as="p" className="text-sm text-muted-foreground">
                    Sold by
                  </Typography>
                  <Typography as="p" className="font-semibold">
                    {shop?.record.name ?? `${sellerPubky.slice(0, 10)}…`}
                  </Typography>
                </div>
                <Button asChild variant="secondary" size="sm" className="rounded-full">
                  <Link href={getMarketplaceShopRoute(sellerPubky)} overrideDefaults>
                    View shop
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <MarketplaceMessageDialog sellerPubky={sellerPubky} listingId={listingId} />
            <MarketplaceReportDialog targetId={aggregateId} />

            <Typography as="p" className="text-base leading-7 text-muted-foreground">
              {record.description}
            </Typography>

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
                      : `${record.location.region ? `${record.location.region}, ` : ''}${record.location.countryCode}`}
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
              ) : (
                <>
                  <Button
                    size="lg"
                    className="flex-1 rounded-full"
                    disabled={adapterMode === 'unavailable' || !selectedVariant || selectedVariant.quantity === 0}
                    onClick={() =>
                      selectedVariant &&
                      void cart.add(`${record.ownerPubky}:${record.listingId}`, selectedVariant.id, 1)
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
                  record.sale.format === 'auction'
                    ? favorite.isFavorite
                      ? 'Remove from watchlist'
                      : 'Add to watchlist'
                    : favorite.isFavorite
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                }
                aria-pressed={favorite.isFavorite}
                disabled={favorite.isMutating}
                onClick={favorite.toggle}
              >
                {record.sale.format === 'auction' ? (
                  <Bell className={favorite.isFavorite ? 'fill-brand text-brand' : ''} />
                ) : (
                  <Heart className={favorite.isFavorite ? 'fill-brand text-brand' : ''} />
                )}
              </Button>
            </div>
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
