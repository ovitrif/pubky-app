'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Trash2 } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';
import { APP_ROUTES, MARKETPLACE_ROUTES } from '@/app/routes';
import { Button } from '@/atoms/Button/Button';
import { Card, CardContent } from '@/atoms/Card/Card';
import { Checkbox } from '@/atoms/Checkbox/Checkbox';
import { Container } from '@/atoms/Container/Container';
import { Heading } from '@/atoms/Heading/Heading';
import { Label } from '@/atoms/Label/Label';
import { Link } from '@/atoms/Link/Link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/atoms/Select/Select';
import { Skeleton } from '@/atoms/Skeleton/Skeleton';
import { Typography } from '@/atoms/Typography/Typography';
import { COMMERCE_SANDBOX_PAYMENT_ENDPOINTS } from '@/config/commerce';
import { useMarketplaceCart } from '@/hooks/useMarketplaceCart/useMarketplaceCart';
import { useMarketplaceCheckout } from '@/hooks/useMarketplaceCheckout/useMarketplaceCheckout';
import { useRequireAuth } from '@/hooks/useRequireAuth/useRequireAuth';
import { formatCommerceMoney } from '@/libs/commerce/format';
import {
  quoteSandboxCart,
  quoteSandboxListingShippingMinor,
  resolveListingFulfillmentMethod,
} from '@/libs/commerce/tax-adapter';
import { ControlledInputField } from '@/molecules/ControlledInputField/ControlledInputField';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';
import { MarketplaceGuaranteeTerms } from '@/organisms/Marketplace/MarketplaceGuaranteeTerms';
import { MarketplaceQuantityStepper } from '@/organisms/Marketplace/MarketplaceQuantityStepper';
import { useAuthStore } from '@/stores/auth/auth.store';

export function MarketplaceCart() {
  const router = useRouter();
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const { requireAuth } = useRequireAuth();
  const cart = useMarketplaceCart();
  const checkout = useMarketplaceCheckout(cart.items, cart.clear);
  const couponCode = useWatch({ control: checkout.form.control, name: 'couponCode' });
  const estimate = quoteSandboxCart(
    cart.items.map((item) => {
      const variant = item.listing.record.variants.find(({ id }) => id === item.variantId);
      const price =
        variant?.priceOverride ??
        (item.listing.record.sale.format === 'auction' ? null : item.listing.record.sale.unitPrice);
      return {
        sellerId: item.listing.seller_id,
        lineSubtotalMinor: (price?.amountMinor ?? 0) * item.quantity,
        fulfillment: resolveListingFulfillmentMethod(item.listing.record.fulfillmentMethods),
        shippingMinor: quoteSandboxListingShippingMinor({
          fulfillment: resolveListingFulfillmentMethod(item.listing.record.fulfillmentMethods),
          shippingOptions: item.listing.record.shippingOptions,
          packageWeightGrams: item.listing.record.package?.weightGrams,
        }),
      };
    }),
    { couponCode },
  );

  const submit = async () => {
    const result = requireAuth(async () => checkout.submit());
    if (!result) return;
    if (await result) router.push(MARKETPLACE_ROUTES.ORDERS);
  };

  return (
    <ContentLayout
      showLeftSidebar={false}
      showRightSidebar={false}
      showLeftMobileButton={false}
      showRightMobileButton={false}
      className="pb-28"
      classNameWrapperContent="max-w-6xl"
    >
      <Container overrideDefaults className="flex w-full flex-col gap-6 px-4 sm:px-6">
        <Link
          href={APP_ROUTES.MARKETPLACE}
          overrideDefaults
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Marketplace
        </Link>
        <div>
          <Heading level={1} size="xl" className="text-4xl sm:text-6xl">
            Cart
          </Heading>
          <Typography as="p" className="mt-2 text-muted-foreground">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · local-first until checkout.
          </Typography>
        </div>

        {cart.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : cart.items.length ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="flex flex-col gap-3">
              {cart.items.map((item) => {
                const variant = item.listing.record.variants.find(({ id }) => id === item.variantId);
                const price =
                  variant?.priceOverride ??
                  (item.listing.record.sale.format === 'auction' ? null : item.listing.record.sale.unitPrice);
                return (
                  <Card key={item.id} className="border py-4">
                    <CardContent className="flex items-center gap-4 px-4">
                      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-brand/15">
                        <ShoppingCart className="size-7 text-brand" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography as="h2" className="truncate font-semibold">
                          {item.listing.record.title}
                        </Typography>
                        <Typography as="p" className="text-sm text-muted-foreground">
                          {variant ? Object.values(variant.options).join(' · ') || 'Default' : 'Default'}
                        </Typography>
                        {price && (
                          <Typography as="p" className="mt-1 font-bold text-brand">
                            {formatCommerceMoney(price)}
                          </Typography>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <MarketplaceQuantityStepper
                          value={item.quantity}
                          max={variant?.quantity ?? item.quantity}
                          label={item.listing.record.title}
                          onChange={(next) => void cart.update(item.listingId, item.variantId, next)}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${item.listing.record.title}`}
                          onClick={() => void cart.remove(item.listingId, item.variantId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="h-fit border">
              <CardContent className="grid gap-4 px-6">
                <Typography as="h2" className="text-xl font-semibold">
                  {currentUserPubky ? 'Delivery and guarantee' : 'Sign in to check out'}
                </Typography>
                {currentUserPubky ? (
                  <>
                    <ControlledInputField name="name" control={checkout.form.control} label="Recipient" />
                    <ControlledInputField name="line1" control={checkout.form.control} label="Address line 1" />
                    <ControlledInputField name="line2" control={checkout.form.control} label="Address line 2" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ControlledInputField name="city" control={checkout.form.control} label="City" />
                      <ControlledInputField name="region" control={checkout.form.control} label="Region" />
                      <ControlledInputField name="postalCode" control={checkout.form.control} label="Postal code" />
                      <ControlledInputField name="countryCode" control={checkout.form.control} label="Country" />
                    </div>
                    <ControlledInputField name="couponCode" control={checkout.form.control} label="Coupon (optional)" />
                    <Controller
                      name="paymentEndpoint"
                      control={checkout.form.control}
                      render={({ field }) => (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="paymentEndpoint">Sandbox payment endpoint</Label>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="paymentEndpoint" className="h-11 w-full rounded-md border px-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMERCE_SANDBOX_PAYMENT_ENDPOINTS.map((endpoint) => (
                                <SelectItem key={endpoint.id} value={endpoint.id}>
                                  {endpoint.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Typography as="p" className="text-xs text-muted-foreground">
                            Simulated Paykit discovery only. This does not open Bitkit or move Bitcoin.
                          </Typography>
                        </div>
                      )}
                    />
                    <MarketplaceGuaranteeTerms compact />
                    <Controller
                      name="acceptsGuarantee"
                      control={checkout.form.control}
                      render={({ field }) => (
                        <Label className="items-start gap-3">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <span>
                            I accept sandbox guarantee policy v1. Eligibility, exclusions, evidence, and deadlines above
                            are frozen on the order.
                          </span>
                        </Label>
                      )}
                    />
                  </>
                ) : (
                  <Typography as="p" className="text-sm text-muted-foreground">
                    Your cart stays on this device. Restore a Pubky session to create a sandbox order. Checkout never
                    uses the reserved guest cart owner as a buyer.
                  </Typography>
                )}
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <Typography as="span">Items</Typography>
                    <Typography as="span" className="font-bold">
                      {formatCommerceMoney({ amountMinor: cart.subtotalMinor, currency: 'USD', exponent: 2 })}
                    </Typography>
                  </div>
                  <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                    <Typography as="span">Sandbox shipping</Typography>
                    <Typography as="span">
                      {formatCommerceMoney({ amountMinor: estimate.shippingMinor, currency: 'USD', exponent: 2 })}
                    </Typography>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <Typography as="span">Sandbox tax</Typography>
                    <Typography as="span">
                      {formatCommerceMoney({ amountMinor: estimate.taxMinor, currency: 'USD', exponent: 2 })}
                    </Typography>
                  </div>
                  {estimate.discountMinor > 0 ? (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <Typography as="span">Coupon {couponCode}</Typography>
                      <Typography as="span">
                        −
                        {formatCommerceMoney({
                          amountMinor: estimate.discountMinor,
                          currency: 'USD',
                          exponent: 2,
                        })}
                      </Typography>
                    </div>
                  ) : couponCode ? (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <Typography as="span">Coupon {couponCode}</Typography>
                      <Typography as="span">Quoted at checkout if the seller accepts it</Typography>
                    </div>
                  ) : null}
                  <div className="mt-2 flex justify-between">
                    <Typography as="span">Estimated total</Typography>
                    <Typography as="span" className="font-bold">
                      {formatCommerceMoney({ amountMinor: estimate.totalMinor, currency: 'USD', exponent: 2 })}
                    </Typography>
                  </div>
                  <Typography as="p" className="mt-2 text-xs text-muted-foreground">
                    {estimate.taxAdapterVersion} + {estimate.shippingAdapterVersion}. Digital-only seller groups have $0
                    shipping. Physical listings use free, flat, or sandbox-calculated rates. Seller coupon SAVE10 is
                    quoted here at 10% off items; checkout remains the authority and cannot exceed items.
                  </Typography>
                </div>
                {currentUserPubky ? (
                  <Button className="w-full rounded-full" onClick={submit}>
                    Place sandbox order
                  </Button>
                ) : (
                  <Button className="w-full rounded-full" onClick={() => requireAuth(() => undefined)}>
                    Sign in to check out
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <ShoppingCart className="mb-3 size-10 text-muted-foreground" />
            <Heading level={2} size="md">
              Your cart is empty
            </Heading>
          </div>
        )}
      </Container>
    </ContentLayout>
  );
}
