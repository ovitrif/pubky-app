'use client';

import { ArrowLeft, CheckCircle2, Clock3, ReceiptText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { APP_ROUTES } from '@/app/routes';
import { Badge } from '@/atoms/Badge/Badge';
import { Button } from '@/atoms/Button/Button';
import { Card, CardContent } from '@/atoms/Card/Card';
import { Container } from '@/atoms/Container/Container';
import { Heading } from '@/atoms/Heading/Heading';
import { Link } from '@/atoms/Link/Link';
import { Skeleton } from '@/atoms/Skeleton/Skeleton';
import { Typography } from '@/atoms/Typography/Typography';
import { useMarketplaceOrders } from '@/hooks/useMarketplaceOrders/useMarketplaceOrders';
import { buyerPaymentStatus } from '@/libs/commerce/buyer-payment-status';
import { formatCommerceMoney } from '@/libs/commerce/format';
import { SANDBOX_GUARANTEE_POLICY } from '@/libs/commerce/sandbox-guarantee';
import { ContentLayout } from '@/organisms/ContentLayout/ContentLayout';
import { MarketplaceOrderActions } from '@/organisms/Marketplace/MarketplaceOrderActions';
import { useAuthStore } from '@/stores/auth/auth.store';

export function MarketplaceOrders() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const { orders, isLoading, error, advancePayment, actOnOrder } = useMarketplaceOrders();

  return (
    <ContentLayout
      showLeftSidebar={false}
      showRightSidebar={false}
      showLeftMobileButton={false}
      showRightMobileButton={false}
      className="pb-28"
      classNameWrapperContent="max-w-5xl"
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
            Orders
          </Heading>
          <Typography as="p" className="mt-2 text-muted-foreground">
            Buyer and seller timelines with sandbox payment facts.
          </Typography>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 p-4">
            {error}
          </div>
        ) : orders.length ? (
          <div className="grid gap-4">
            {orders.map(({ order, payment, receipt }) => {
              const isBuyer = currentUserPubky === order.buyerPubky;
              return (
                <Card key={order.id} className="border py-5">
                  <CardContent className="grid gap-5 px-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Badge>{isBuyer ? 'Purchase' : 'Sale'}</Badge>
                        <Badge variant="secondary">{order.state.replaceAll('_', ' ')}</Badge>
                        {payment && <Badge variant="outline">{buyerPaymentStatus(payment.state).label}</Badge>}
                      </div>
                      {order.lines.map((line) => (
                        <Typography key={line.listingAggregateId} as="p" className="font-semibold">
                          {line.title} × {line.quantity}
                        </Typography>
                      ))}
                      <Typography as="p" className="mt-2 text-2xl font-bold text-brand">
                        {formatCommerceMoney(order.total)}
                      </Typography>
                      <Typography as="p" className="mt-1 text-xs text-muted-foreground">
                        Items {formatCommerceMoney(order.subtotal)}
                        {order.discount ? ` · Discount ${formatCommerceMoney(order.discount)}` : ''} · Shipping{' '}
                        {formatCommerceMoney(order.shipping)} · Tax {formatCommerceMoney(order.tax)}
                        {order.couponCode ? ` · Coupon ${order.couponCode}` : ''}
                        {order.payoutState ? ` · Payout ${order.payoutState}` : ''}
                        {` · ${SANDBOX_GUARANTEE_POLICY.title} frozen`}
                      </Typography>
                      {payment && (
                        <Typography as="p" className="mt-2 text-sm text-muted-foreground" role="status">
                          {buyerPaymentStatus(payment.state).detail}
                        </Typography>
                      )}
                      {order.origin && order.origin !== 'checkout' && (
                        <Typography as="p" className="mt-1 text-xs text-muted-foreground">
                          Created from {order.origin.replaceAll('_', ' ')}
                          {!order.deliveryAddress && order.fulfillment !== 'digital'
                            ? ' · Delivery address required before shipping'
                            : ''}
                        </Typography>
                      )}
                      {order.reviews?.map((review) => (
                        <Typography key={review.id} as="p" className="mt-2 text-sm text-muted-foreground">
                          Review {review.rating}/5{review.editedAt ? ' · edited' : ''}: {review.text}
                          {review.reply ? ` · Reply: ${review.reply}` : ''}
                        </Typography>
                      ))}
                      {receipt && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                          <ReceiptText className="size-4 text-brand" />
                          Receipt integrity {receipt.contentHash.slice(0, 12)}…
                        </div>
                      )}
                      {order.shipment && (
                        <Typography as="p" className="mt-2 text-sm text-muted-foreground">
                          {order.shipment.carrier} · {order.shipment.trackingNumber} · {order.shipment.state}
                          {order.shipment.exception
                            ? ` · Exception ${order.shipment.exception.code.replaceAll('_', ' ')}: ${order.shipment.exception.notes}`
                            : ''}
                        </Typography>
                      )}
                      {order.returnRequest && (
                        <Typography as="p" className="mt-2 text-sm text-muted-foreground">
                          Return {order.returnRequest.state}: {order.returnRequest.reason}
                          {order.returnRequest.offeredAmountMinor
                            ? ` · Partial offer $${(order.returnRequest.offeredAmountMinor / 100).toFixed(2)}`
                            : ''}
                          {order.returnRequest.returnShipment
                            ? ` · ${order.returnRequest.returnShipment.carrier} ${order.returnRequest.returnShipment.trackingNumber}`
                            : ''}
                          {order.returnRequest.inspection
                            ? ` · Inspection ${order.returnRequest.inspection.outcome}`
                            : ''}
                        </Typography>
                      )}
                      {order.digitalDelivery && (
                        <Typography as="p" className="mt-2 text-sm text-muted-foreground">
                          Sandbox Locks credential {order.digitalDelivery.credentialId.slice(0, 8)}… · access{' '}
                          {order.digitalDelivery.accessCount} ·{' '}
                          {order.digitalDelivery.integrityOk ? 'hash verified' : 'integrity failed'}
                        </Typography>
                      )}
                      {isBuyer && payment && payment.state !== 'confirmed' && (
                        <div className="mt-3 w-fit rounded-xl border bg-card p-3">
                          <QRCodeSVG
                            value={`sandbox:paykit:${payment.id}?amount=${order.total.amountMinor}&asset=${order.total.currency}`}
                            size={96}
                            className="text-foreground"
                          />
                          <Typography as="p" className="mt-2 text-xs text-amber-200">
                            Simulated invoice QR · not a real Bitcoin payment
                          </Typography>
                        </div>
                      )}
                      {order.externalRefund && (
                        <Typography as="p" className="mt-2 text-sm text-brand">
                          External refund evidence: {order.externalRefund.transactionId}
                        </Typography>
                      )}
                    </div>

                    {isBuyer && payment && payment.state !== 'confirmed' && (
                      <div className="flex flex-wrap gap-2">
                        {payment.state === 'awaiting_entitlement' && (
                          <Button
                            variant="secondary"
                            className="rounded-full"
                            onClick={() => void advancePayment(payment, 'detected', 0)}
                          >
                            <Clock3 className="mr-2 size-4" />
                            Simulate detected
                          </Button>
                        )}
                        {(payment.state === 'awaiting_entitlement' || payment.state === 'detected') && (
                          <Button className="rounded-full" onClick={() => void advancePayment(payment, 'confirmed', 1)}>
                            <CheckCircle2 className="mr-2 size-4" />
                            Confirm payment
                          </Button>
                        )}
                        {payment.state === 'awaiting_entitlement' && (
                          <Button
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => void advancePayment(payment, 'expired', 0)}
                          >
                            Expire marketplace window
                          </Button>
                        )}
                        {(payment.state === 'awaiting_entitlement' || payment.state === 'detected') && (
                          <Button
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => void advancePayment(payment, 'manual_review', 0)}
                          >
                            Send to manual review
                          </Button>
                        )}
                      </div>
                    )}
                    <MarketplaceOrderActions order={order} isBuyer={isBuyer} actOnOrder={actOnOrder} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <ReceiptText className="mb-3 size-10 text-muted-foreground" />
            <Heading level={2} size="md">
              No orders yet
            </Heading>
          </div>
        )}
      </Container>
    </ContentLayout>
  );
}
