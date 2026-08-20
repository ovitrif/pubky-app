'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, Copy, Download, Package, Pause, Play, ShoppingBag, Trash2, TrendingUp, Upload } from 'lucide-react';
import { APP_ROUTES, MARKETPLACE_ROUTES } from '@/app/routes';
import { Badge } from '@/atoms/Badge/Badge';
import { Button } from '@/atoms/Button/Button';
import { Card, CardContent } from '@/atoms/Card/Card';
import { Checkbox } from '@/atoms/Checkbox/Checkbox';
import { Container } from '@/atoms/Container/Container';
import { Heading } from '@/atoms/Heading/Heading';
import { Input } from '@/atoms/Input/Input';
import { Label } from '@/atoms/Label/Label';
import { Link } from '@/atoms/Link/Link';
import { Skeleton } from '@/atoms/Skeleton/Skeleton';
import { Typography } from '@/atoms/Typography/Typography';
import { useMarketplaceSellerDashboard } from '@/hooks/useMarketplaceSellerDashboard/useMarketplaceSellerDashboard';
import { formatCommerceMoney } from '@/libs/commerce/format';
import { printMarketplacePackingSlip } from '@/libs/commerce/packing-slip';
import { printMarketplaceShippingLabel } from '@/libs/commerce/shipping-label';
import { MarketplaceRelistDialog } from '@/organisms/Marketplace/MarketplaceRelistDialog';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';

export function MarketplaceDashboard() {
  const dashboard = useMarketplaceSellerDashboard();
  const [selected, setSelected] = useState<string[]>([]);
  const importInput = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([dashboard.exportCsv()], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pubky-marketplace-inventory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ContentLayout
      showLeftSidebar={false}
      showRightSidebar={false}
      showLeftMobileButton={false}
      showRightMobileButton={false}
      className="pb-28"
      classNameWrapperContent="max-w-7xl"
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Heading level={1} size="xl" className="text-4xl sm:text-6xl">
              Seller dashboard
            </Heading>
            <Typography as="p" className="mt-2 text-muted-foreground">
              Inventory, coupons, sandbox statements, and order work queues.
            </Typography>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="rounded-full">
              <Link href={MARKETPLACE_ROUTES.ORDERS} overrideDefaults>
                Orders
              </Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-full">
              <Link href={MARKETPLACE_ROUTES.OFFERS} overrideDefaults>
                Offers
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href={MARKETPLACE_ROUTES.SETTINGS} overrideDefaults>
                Payment settings
              </Link>
            </Button>
          </div>
        </div>

        {dashboard.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Active listings', value: dashboard.metrics.activeListings, icon: ShoppingBag },
                { label: 'Inventory', value: dashboard.metrics.totalInventory, icon: Package },
                { label: 'Low stock', value: dashboard.metrics.lowStock, icon: Package },
                { label: 'Paid orders', value: dashboard.metrics.paidOrders, icon: TrendingUp },
                {
                  label: 'Sandbox revenue',
                  value: formatCommerceMoney({
                    amountMinor: dashboard.metrics.revenueMinor,
                    currency: 'USD',
                    exponent: 2,
                  }),
                  icon: TrendingUp,
                },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="gap-3 border py-4">
                  <CardContent className="px-4">
                    <Icon className="mb-3 size-5 text-brand" />
                    <Typography as="p" className="text-2xl font-bold">
                      {value}
                    </Typography>
                    <Typography as="p" className="text-sm text-muted-foreground">
                      {label}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </div>

            {dashboard.statement && (
              <Card className="border">
                <CardContent className="grid gap-3 px-5">
                  <Typography as="h2" className="text-xl font-semibold">
                    Sandbox statement
                  </Typography>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <StatementStat label="Paid" amount={dashboard.statement.paidMinor} />
                    <StatementStat label="Held" amount={dashboard.statement.heldMinor} />
                    <StatementStat label="Released" amount={dashboard.statement.releasedMinor} />
                    <StatementStat label="Refunded" amount={dashboard.statement.refundedMinor} />
                  </div>
                  <Typography as="p" className="text-xs text-muted-foreground">
                    These are prototype ledger totals, not settled Bitcoin payouts.
                  </Typography>
                </CardContent>
              </Card>
            )}

            <Card className="border">
              <CardContent className="grid gap-4 px-5">
                <Typography as="h2" className="text-xl font-semibold">
                  Coupons
                </Typography>
                <div className="flex flex-wrap items-end gap-3">
                  <Label className="grid gap-1">
                    Code
                    <Input
                      value={dashboard.couponCode}
                      onChange={(event) => dashboard.setCouponCode(event.target.value)}
                      placeholder="SAVE10"
                      className="w-36"
                    />
                  </Label>
                  <Label className="grid gap-1">
                    Percent off
                    <Input
                      value={dashboard.percentOff}
                      onChange={(event) => dashboard.setPercentOff(event.target.value)}
                      placeholder="10"
                      className="w-24"
                    />
                  </Label>
                  <Button className="rounded-full" onClick={() => void dashboard.createPromotion()}>
                    Create coupon
                  </Button>
                </div>
                {dashboard.promotions.length ? (
                  <ul className="grid gap-2 text-sm">
                    {dashboard.promotions.map((promotion) => (
                      <li
                        key={promotion.id}
                        className="flex flex-wrap justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <span className="font-semibold">{promotion.code}</span>
                        <span>
                          {promotion.percentOff}% · {promotion.usedCount}/{promotion.usageLimit} used
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Typography as="p" className="text-sm text-muted-foreground">
                    No coupons yet. Codes apply at checkout without producing negative totals.
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="grid gap-4 px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Typography as="h2" className="text-xl font-semibold">
                      Inventory
                    </Typography>
                    <Typography as="p" className="text-sm text-muted-foreground">
                      {dashboard.metrics.openOffers} open offers need attention.
                    </Typography>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      disabled={!selected.length}
                      onClick={() => void dashboard.updateListingState(selected, 'paused')}
                    >
                      <Pause className="mr-2 size-4" />
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      disabled={!selected.length}
                      onClick={() => void dashboard.updateListingState(selected, 'active')}
                    >
                      <Play className="mr-2 size-4" />
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      disabled={!selected.length}
                      onClick={() => void dashboard.updateListingState(selected, 'removed')}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </Button>
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={exportCsv}>
                      <Download className="mr-2 size-4" />
                      Export CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => importInput.current?.click()}
                    >
                      <Upload className="mr-2 size-4" />
                      Import CSV
                    </Button>
                    <input
                      ref={importInput}
                      type="file"
                      accept=".csv,text/csv"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void file.text().then((text) => dashboard.importCsv(text));
                        event.target.value = '';
                      }}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-2xl text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="p-3">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="p-3">Listing</th>
                        <th className="p-3">State</th>
                        <th className="p-3">Format</th>
                        <th className="p-3">Inventory</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.listings.map((listing) => {
                        const checked = selected.includes(listing.id);
                        return (
                          <tr key={listing.id} className="border-b last:border-0">
                            <td className="p-3">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) =>
                                  setSelected((current) =>
                                    next ? [...current, listing.id] : current.filter((id) => id !== listing.id),
                                  )
                                }
                                aria-label={`Select ${listing.record.title}`}
                              />
                            </td>
                            <td className="p-3 font-semibold">{listing.record.title}</td>
                            <td className="p-3">
                              <Badge variant="secondary">{listing.state}</Badge>
                            </td>
                            <td className="p-3">{listing.format.replace('_', ' ')}</td>
                            <td className="p-3">
                              {listing.record.variants.reduce((total, variant) => total + variant.quantity, 0)}
                            </td>
                            <td className="p-3">
                              {formatCommerceMoney({
                                amountMinor: listing.price_minor,
                                currency: listing.currency,
                                exponent: 2,
                              })}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full"
                                  onClick={() => void dashboard.duplicateListing(listing.id)}
                                >
                                  <Copy className="mr-2 size-4" />
                                  Duplicate
                                </Button>
                                <MarketplaceRelistDialog
                                  record={listing.record}
                                  defaultPrice={(listing.price_minor / 100).toFixed(2)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {dashboard.sellerOrders.length > 0 && (
              <Card className="border">
                <CardContent className="grid gap-3 px-5">
                  <Typography as="h2" className="text-xl font-semibold">
                    Payout queue
                  </Typography>
                  {dashboard.sellerOrders.map(({ order }) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div>
                        <Typography as="p" className="font-semibold">
                          {order.lines[0]?.title ?? order.id}
                        </Typography>
                        <Typography as="p" className="text-sm text-muted-foreground">
                          {formatCommerceMoney(order.total)} · payout {order.payoutState ?? 'held'}
                        </Typography>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => printMarketplacePackingSlip(order)}
                        >
                          Packing slip
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => printMarketplaceShippingLabel(order)}
                        >
                          Shipping label
                        </Button>
                        {order.payoutState === 'held' &&
                          ['delivered', 'completed'].includes(order.state) &&
                          !order.dispute && (
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={() => void dashboard.releasePayout(order.id, order.revision)}
                            >
                              Release payout
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Container>
    </ContentLayout>
  );
}

function StatementStat({ label, amount }: { label: string; amount: number }) {
  return (
    <div>
      <Typography as="p" className="text-lg font-bold">
        {formatCommerceMoney({ amountMinor: amount, currency: 'USD', exponent: 2 })}
      </Typography>
      <Typography as="p" className="text-sm text-muted-foreground">
        {label}
      </Typography>
    </div>
  );
}
