'use client';

import { ArrowLeft, Shield } from 'lucide-react';
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
import { useMarketplaceRisk } from '@/hooks/useMarketplaceRisk/useMarketplaceRisk';
import { MarketplaceStaffChrome } from '@/organisms/Marketplace/MarketplaceStaffChrome';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';

export function MarketplaceRisk() {
  const risk = useMarketplaceRisk();

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
            Risk
          </Heading>
          <MarketplaceStaffChrome
            role="risk"
            description="Investigate fraud signals and apply or release transaction holds. Risk cannot refund or decide listing reports."
          />
        </div>

        {risk.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : risk.error ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
            {risk.error}
          </div>
        ) : (
          <>
            <Card className="border">
              <CardContent className="grid gap-3 px-5">
                <Typography as="h2" className="text-xl font-semibold">
                  Review signals
                </Typography>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    className="h-11 rounded-md border bg-background px-3"
                    aria-label="Risk signal type"
                    value={risk.riskType}
                    onChange={(event) => risk.setRiskType(event.target.value as typeof risk.riskType)}
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
                    value={risk.riskTargetType}
                    onChange={(event) => risk.setRiskTargetType(event.target.value as typeof risk.riskTargetType)}
                  >
                    <option value="listing">Listing</option>
                    <option value="user">User</option>
                    <option value="order">Order</option>
                    <option value="payment">Payment</option>
                    <option value="auction">Auction</option>
                  </select>
                  <Input
                    value={risk.riskTargetId}
                    onChange={(event) => risk.setRiskTargetId(event.target.value)}
                    placeholder="Target id"
                    aria-label="Risk target id"
                  />
                </div>
                <Input
                  value={risk.notes}
                  onChange={(event) => risk.setNotes(event.target.value)}
                  placeholder="Review notes"
                  aria-label="Risk notes"
                />
                <Button className="w-fit rounded-full" onClick={() => void risk.flagRisk()}>
                  Record risk signal
                </Button>
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="grid gap-3 px-5">
                <Typography as="h2" className="text-xl font-semibold">
                  Transaction holds
                </Typography>
                <Input
                  value={risk.subjectPubky}
                  onChange={(event) => risk.setSubjectPubky(event.target.value)}
                  placeholder="Subject pubky"
                  aria-label="Hold subject pubky"
                />
                <Button className="w-fit rounded-full" onClick={() => void risk.hold()}>
                  Hold transactions
                </Button>
                {risk.holds.map((hold) => (
                  <div key={hold.subjectPubky} className="rounded-lg border px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {hold.actions.map((action) => (
                        <Badge key={action}>{action.replaceAll('_', ' ')}</Badge>
                      ))}
                    </div>
                    <Typography as="p" className="mt-1 text-sm">
                      {hold.subjectPubky}
                    </Typography>
                    {hold.actions.includes('transaction_hold') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 rounded-full"
                        onClick={() => void risk.release(hold.subjectPubky)}
                      >
                        Release hold
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {risk.signals.length > 0 ? (
              <div className="grid gap-2">
                {risk.signals.map((signal) => (
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
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed">
                <Shield className="mb-3 size-10 text-muted-foreground" />
                <Heading level={2} size="md">
                  No open risk signals
                </Heading>
              </div>
            )}
          </>
        )}
      </Container>
    </ContentLayout>
  );
}
