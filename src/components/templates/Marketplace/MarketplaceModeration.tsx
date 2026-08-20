'use client';

import { ArrowLeft, ShieldAlert } from 'lucide-react';
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
import {
  type MarketplaceModerationDecision,
  useMarketplaceModeration,
} from '@/hooks/useMarketplaceModeration/useMarketplaceModeration';
import { isMarketplaceSandboxOperator } from '@/libs/commerce/sandbox-operator';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';

const DECISIONS: Array<{ value: MarketplaceModerationDecision; label: string }> = [
  { value: 'dismiss', label: 'Dismiss' },
  { value: 'warn', label: 'Warn' },
  { value: 'restrict_listing', label: 'Restrict listing' },
  { value: 'visibility_limit', label: 'Visibility limit' },
  { value: 'delist', label: 'Delist' },
  { value: 'message_limit', label: 'Message limit' },
  { value: 'transaction_hold', label: 'Hold transactions' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'ban', label: 'Ban' },
];

export function MarketplaceModeration() {
  const moderation = useMarketplaceModeration();
  const alertCount =
    (moderation.invariants?.unbalancedOrders.length ?? 0) +
    (moderation.invariants?.oversoldListings.length ?? 0) +
    (moderation.invariants?.duplicateAuctionWinners.length ?? 0) +
    (moderation.invariants?.stuckFulfillment.length ?? 0) +
    (moderation.invariants?.reservedOnPaidOrders.length ?? 0);

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
            Moderation queue
          </Heading>
          <Typography as="p" className="mt-2 text-muted-foreground">
            Assignment, decisions, reversals, and invariant alerts are append-only.
          </Typography>
          {isMarketplaceSandboxOperator() && (
            <Badge className="mt-3" variant="outline">
              Sandbox operator · staff commands use the reserved moderator
            </Badge>
          )}
        </div>

        <Input
          value={moderation.query}
          onChange={(event) => moderation.setQuery(event.target.value)}
          placeholder="Search reports, listings, or order ids"
          aria-label="Admin search"
        />

        <Card className="border">
          <CardContent className="grid gap-3 px-5">
            <Typography as="h2" className="text-xl font-semibold">
              Risk signals
            </Typography>
            <Typography as="p" className="text-sm text-muted-foreground">
              Auction manipulation, takeover, payment/refund abuse, off-platform scams, and payout changes create
              append-only review signals. They never rewrite transaction history.
            </Typography>
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                className="h-11 rounded-md border bg-background px-3"
                aria-label="Risk signal type"
                value={moderation.riskType}
                onChange={(event) => moderation.setRiskType(event.target.value as typeof moderation.riskType)}
              >
                <option value="auction_manipulation">Auction manipulation</option>
                <option value="account_takeover">Account takeover</option>
                <option value="payment_abuse">Payment abuse</option>
                <option value="refund_abuse">Refund abuse</option>
                <option value="off_platform_scam">Off-platform scam</option>
                <option value="suspicious_payout">Suspicious payout</option>
              </select>
              <select
                className="h-11 rounded-md border bg-background px-3"
                aria-label="Risk target type"
                value={moderation.riskTargetType}
                onChange={(event) =>
                  moderation.setRiskTargetType(event.target.value as typeof moderation.riskTargetType)
                }
              >
                <option value="listing">Listing</option>
                <option value="user">User</option>
                <option value="order">Order</option>
                <option value="payment">Payment</option>
                <option value="auction">Auction</option>
              </select>
              <Input
                value={moderation.riskTargetId}
                onChange={(event) => moderation.setRiskTargetId(event.target.value)}
                placeholder="Target id"
                aria-label="Risk target id"
              />
            </div>
            <Button className="w-fit rounded-full" onClick={() => void moderation.flagRisk()}>
              Record risk signal
            </Button>
            {moderation.riskSignals.length > 0 && (
              <div className="grid gap-2">
                {moderation.riskSignals.map((signal) => (
                  <div key={signal.id} className="rounded-lg border px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{signal.signalType.replaceAll('_', ' ')}</Badge>
                      <Badge variant="secondary">{signal.targetType}</Badge>
                    </div>
                    <Typography as="p" className="mt-1 text-sm">
                      {signal.targetId}
                    </Typography>
                    <Typography as="p" className="text-xs text-muted-foreground">
                      {signal.details}
                    </Typography>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {alertCount > 0 && (
          <div
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            Invariant alerts: {moderation.invariants?.unbalancedOrders.length ?? 0} unbalanced ledgers,{' '}
            {moderation.invariants?.oversoldListings.length ?? 0} oversold listings,{' '}
            {moderation.invariants?.duplicateAuctionWinners.length ?? 0} duplicate winners,{' '}
            {moderation.invariants?.stuckFulfillment.length ?? 0} stuck fulfillments,{' '}
            {moderation.invariants?.reservedOnPaidOrders.length ?? 0} paid orders still reserved.
          </div>
        )}

        {isMarketplaceSandboxOperator() && (
          <Card className="border">
            <CardContent className="grid gap-3 px-5">
              <Typography as="h2" className="text-xl font-semibold">
                Paid inventory reconcile
              </Typography>
              <Typography as="p" className="text-sm text-muted-foreground">
                Converts leftover reserved units on already-paid orders to sold. Appends inventory.reconciled events and
                does not rewrite payment history.
              </Typography>
              <Button className="w-fit rounded-full" onClick={() => void moderation.reconcilePaidInventory()}>
                Reconcile reserved paid orders
              </Button>
              {moderation.reconcileResult && (
                <Typography as="p" role="status" className="text-sm">
                  {moderation.reconcileResult}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {moderation.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : moderation.error ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
            {moderation.error}
          </div>
        ) : moderation.reports.length ? (
          <div className="grid gap-3">
            {moderation.reports.map((report) => (
              <Card key={report.id} className="border py-4">
                <CardContent className="grid gap-2 px-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{report.reason.replaceAll('_', ' ')}</Badge>
                    <Badge variant="secondary">{report.targetType}</Badge>
                    <Badge variant="outline">{report.state}</Badge>
                    {report.assignedTo && <Badge variant="outline">Assigned</Badge>}
                  </div>
                  <Typography as="p" className="font-semibold">
                    {report.targetId}
                  </Typography>
                  <Typography as="p" className="text-sm text-muted-foreground">
                    {report.details}
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {report.state === 'open' && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => void moderation.assign(report)}
                        >
                          Assign to me
                        </Button>
                        {DECISIONS.map((decision) => (
                          <Button
                            key={decision.value}
                            size="sm"
                            variant={decision.value === 'ban' ? 'default' : 'secondary'}
                            className="rounded-full"
                            onClick={() => void moderation.decide(report, decision.value)}
                          >
                            {decision.label}
                          </Button>
                        ))}
                      </>
                    )}
                    {report.state !== 'open' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => void moderation.reverse(report)}
                      >
                        Reverse
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed">
            <ShieldAlert className="mb-3 size-10 text-muted-foreground" />
            <Heading level={2} size="md">
              Queue clear
            </Heading>
          </div>
        )}
      </Container>
    </ContentLayout>
  );
}
