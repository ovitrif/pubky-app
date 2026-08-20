'use client';

import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';
import { Badge } from '@/atoms/Badge/Badge';
import { Button } from '@/atoms/Button/Button';
import { Card, CardContent } from '@/atoms/Card/Card';
import { Container } from '@/atoms/Container/Container';
import { Heading } from '@/atoms/Heading/Heading';
import { Input } from '@/atoms/Input/Input';
import { Link } from '@/atoms/Link/Link';
import { Skeleton } from '@/atoms/Skeleton/Skeleton';
import { Typography } from '@/atoms/Typography/Typography';
import { useMarketplaceSupport } from '@/hooks/useMarketplaceSupport/useMarketplaceSupport';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';
import { MarketplaceStaffChrome } from '@/organisms/Marketplace/MarketplaceStaffChrome';

export function MarketplaceSupport() {
  const support = useMarketplaceSupport();
  const selected = support.orders.find((order) => order.id === support.selectedOrderId) ?? support.orders[0];

  return (
    <ContentLayout
      showLeftSidebar={false}
      showRightSidebar={false}
      showLeftMobileButton={false}
      showRightMobileButton={false}
      className="pb-28"
      classNameWrapperContent="max-w-4xl"
    >
      <Container overrideDefaults className="flex w-full flex-col gap-6 px-4 sm:px-6">
        <Link href={APP_ROUTES.MARKETPLACE} overrideDefaults className="inline-flex w-fit items-center gap-2 text-sm">
          <ArrowLeft className="size-4" />
          Marketplace
        </Link>
        <div>
          <Heading level={1} size="xl" className="text-4xl sm:text-6xl">
            Support
          </Heading>
          <MarketplaceStaffChrome
            role="support"
            description="Inspect redacted order evidence and add non-financial notes. Support cannot refund, restrict listings, or decide reports."
          />
        </div>

        <Input
          value={support.query}
          onChange={(event) => support.setQuery(event.target.value)}
          placeholder="Search order ids"
          aria-label="Support order search"
        />

        {support.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : support.error ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
            {support.error}
          </div>
        ) : support.orders.length ? (
          <div className="grid gap-3">
            {support.orders.map((order) => (
              <Card key={order.id} className="border py-4">
                <CardContent className="grid gap-2 px-4">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => support.setSelectedOrderId(order.id)}
                    aria-pressed={selected?.id === order.id}
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge>{order.state.replaceAll('_', ' ')}</Badge>
                      <Badge variant="secondary">{order.fulfillment ?? 'physical'}</Badge>
                      <Badge variant="outline">{order.inventoryState ?? 'reserved'}</Badge>
                    </div>
                    <Typography as="p" className="mt-2 font-semibold">
                      {order.id}
                    </Typography>
                    <Typography as="p" className="text-sm text-muted-foreground">
                      {order.deliveryAddress?.city}, {order.deliveryAddress?.region},{' '}
                      {order.deliveryAddress?.countryCode} · street and name redacted
                    </Typography>
                    <Typography as="p" className="text-sm">
                      Total {(order.total.amountMinor / 100).toFixed(2)} {order.total.currency}
                    </Typography>
                  </button>
                  {(order.supportNotes ?? []).map((item) => (
                    <Typography key={item.id} as="p" className="text-sm text-muted-foreground">
                      Note: {item.text}
                    </Typography>
                  ))}
                  {selected?.id === order.id && (
                    <div className="grid gap-2">
                      <Input
                        id="supportNote"
                        name="supportNote"
                        value={support.note}
                        onChange={(event) => support.setNote(event.target.value)}
                        placeholder="Non-financial resolution note"
                        aria-label="Support note"
                      />
                      <Button className="w-fit rounded-full" onClick={() => void support.addNote(order)}>
                        Add support note
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed">
            <LifeBuoy className="mb-3 size-10 text-muted-foreground" />
            <Heading level={2} size="md">
              No scoped orders
            </Heading>
          </div>
        )}
      </Container>
    </ContentLayout>
  );
}
