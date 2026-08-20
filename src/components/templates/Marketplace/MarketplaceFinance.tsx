'use client';

import { ArrowLeft, Landmark } from 'lucide-react';
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
import { useMarketplaceFinance } from '@/hooks/useMarketplaceFinance/useMarketplaceFinance';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';
import { MarketplaceStaffChrome } from '@/organisms/Marketplace/MarketplaceStaffChrome';

export function MarketplaceFinance() {
  const finance = useMarketplaceFinance();
  const debit = finance.entries
    .filter((entry) => entry.direction === 'debit')
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const credit = finance.entries
    .filter((entry) => entry.direction === 'credit')
    .reduce((total, entry) => total + entry.amountMinor, 0);

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
            Finance
          </Heading>
          <MarketplaceStaffChrome
            role="finance"
            description="Reconcile the sandbox ledger and record externally executed refunds. Finance cannot decide reports or restrict listings."
          />
        </div>

        {finance.invariants &&
          (finance.invariants.unbalancedOrders.length > 0 || finance.invariants.reservedOnPaidOrders.length > 0) && (
            <div
              role="status"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
            >
              Invariant alerts: {finance.invariants.unbalancedOrders.length} unbalanced ledgers,{' '}
              {finance.invariants.reservedOnPaidOrders.length} paid orders still reserved.
            </div>
          )}

        {finance.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : finance.error ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
            {finance.error}
          </div>
        ) : (
          <>
            <Card className="border">
              <CardContent className="grid gap-3 px-5">
                <Typography as="h2" className="text-xl font-semibold">
                  Ledger
                </Typography>
                <Typography as="p" className="text-sm text-muted-foreground">
                  {finance.entries.length} entries · debit {(debit / 100).toFixed(2)} · credit{' '}
                  {(credit / 100).toFixed(2)}
                </Typography>
                <Button className="w-fit rounded-full" onClick={() => void finance.reconcilePaidInventory()}>
                  Reconcile reserved paid orders
                </Button>
                {finance.reconcileResult && (
                  <Typography as="p" role="status" className="text-sm">
                    {finance.reconcileResult}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="grid gap-3 px-5">
                <Typography as="h2" className="text-xl font-semibold">
                  Record external refund
                </Typography>
                <Typography as="p" className="text-sm text-muted-foreground">
                  Paykit Server cannot spend. Record a refund only after independent wallet evidence.
                </Typography>
                <Input
                  value={finance.orderId}
                  onChange={(event) => finance.setOrderId(event.target.value)}
                  placeholder="Order id"
                  aria-label="Refund order id"
                />
                <Input
                  value={finance.amountMinor}
                  onChange={(event) => finance.setAmountMinor(event.target.value)}
                  placeholder="Amount minor units"
                  aria-label="Refund amount minor"
                />
                <Input
                  value={finance.transactionId}
                  onChange={(event) => finance.setTransactionId(event.target.value)}
                  placeholder="External transaction id"
                  aria-label="External refund transaction id"
                />
                <Button className="w-fit rounded-full" onClick={() => void finance.recordRefund()}>
                  Record external refund
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              {finance.orders.map((order) => (
                <Card key={order.id} className="border py-4">
                  <CardContent className="grid gap-2 px-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{order.state.replaceAll('_', ' ')}</Badge>
                      <Badge variant="outline">{order.payoutState ?? 'held'}</Badge>
                    </div>
                    <Typography as="p" className="font-semibold">
                      {order.id}
                    </Typography>
                    <Typography as="p" className="text-sm text-muted-foreground">
                      Total {(order.total.amountMinor / 100).toFixed(2)} {order.total.currency}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
              {finance.orders.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed">
                  <Landmark className="mb-3 size-10 text-muted-foreground" />
                  <Heading level={2} size="md">
                    No ledger orders
                  </Heading>
                </div>
              )}
            </div>
          </>
        )}
      </Container>
    </ContentLayout>
  );
}
