'use client';

import { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Button } from '@/atoms/Button/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/atoms/Dialog/Dialog';
import { Label } from '@/atoms/Label/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/atoms/Select/Select';
import { useMarketplaceOrderAction } from '@/hooks/useMarketplaceOrderAction/useMarketplaceOrderAction';
import type { MarketplaceOrderActionData } from '@/hooks/useMarketplaceOrderAction/useMarketplaceOrderAction.types';
import { isMarketplaceSandboxOperator, setMarketplaceSandboxStaffRole } from '@/libs/commerce/sandbox-operator';
import { printMarketplaceReverseLabel } from '@/libs/commerce/shipping-label';
import { ControlledInputField } from '@/molecules/ControlledInputField/ControlledInputField';
import { ControlledTextareaField } from '@/molecules/ControlledTextareaField/ControlledTextareaField';
import { toast } from '@/molecules/Toaster/use-toast';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';

export function MarketplaceOrderActions({
  order,
  isBuyer,
  actOnOrder,
}: {
  order: MarketplaceOrder;
  isBuyer: boolean;
  actOnOrder: (order: MarketplaceOrder, kind: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [canResolveDispute, setCanResolveDispute] = useState(false);
  const action = useMarketplaceOrderAction(order, actOnOrder);
  const actionType = useWatch({ control: action.form.control, name: 'action' });
  const viewerPubky = isBuyer ? order.buyerPubky : order.sellerPubky;
  const ownReview = order.reviews?.find(({ reviewerPubky }) => reviewerPubky === viewerPubky);
  const replyableReview = order.reviews?.find(({ subjectPubky, reply }) => subjectPubky === viewerPubky && !reply);

  useEffect(() => {
    setCanResolveDispute(isMarketplaceSandboxOperator());
  }, []);

  const begin = (next: MarketplaceOrderActionData['action']) => {
    if (next === 'dispute_resolve') setMarketplaceSandboxStaffRole('moderator');
    action.setAction(next);
    setOpen(true);
  };
  const submit = async () => {
    if (await action.submit()) setOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isBuyer &&
          !order.deliveryAddress &&
          ['pending_payment', 'paid', 'processing'].includes(order.state) &&
          order.fulfillment !== 'digital' && (
            <Button size="sm" className="rounded-full" onClick={() => begin('confirm_address')}>
              Confirm delivery address
            </Button>
          )}
        {isBuyer && ['pending_payment', 'paid', 'processing'].includes(order.state) && (
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => begin('cancel')}>
            Cancel order
          </Button>
        )}
        {!isBuyer && ['paid', 'processing'].includes(order.state) && order.fulfillment !== 'digital' && (
          <Button size="sm" className="rounded-full" onClick={() => begin('ship')}>
            Add tracking
          </Button>
        )}
        {!isBuyer && ['paid', 'processing'].includes(order.state) && order.fulfillment !== 'digital' && (
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            onClick={() => void actOnOrder(order, 'fulfillment.ready_for_pickup', {})}
          >
            Ready for pickup
          </Button>
        )}
        {['shipped', 'ready_for_pickup'].includes(order.state) && !order.shipment?.exception && (
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => begin('exception')}>
            Record delivery exception
          </Button>
        )}
        {isBuyer && (order.state === 'shipped' || order.state === 'ready_for_pickup') && (
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => void actOnOrder(order, 'fulfillment.confirm_delivery', {})}
          >
            Confirm delivery
          </Button>
        )}
        {isBuyer && ['delivered', 'completed'].includes(order.state) && !order.returnRequest && (
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => begin('return')}>
            Request return
          </Button>
        )}
        {!isBuyer && order.state === 'cancel_requested' && (
          <Button size="sm" className="rounded-full" onClick={() => void actOnOrder(order, 'order.cancel_approve', {})}>
            Approve cancellation
          </Button>
        )}
        {isBuyer && order.state === 'return_in_transit' && (
          <Button size="sm" className="rounded-full" onClick={() => begin('return_ship')}>
            Add return tracking
          </Button>
        )}
        {order.returnRequest && (
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            onClick={() => printMarketplaceReverseLabel(order)}
          >
            Print reverse label
          </Button>
        )}
        {!isBuyer && order.state === 'return_requested' && (
          <>
            <Button size="sm" className="rounded-full" onClick={() => void actOnOrder(order, 'return.approve', {})}>
              Approve return
            </Button>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => begin('partial')}>
              Offer partial
            </Button>
          </>
        )}
        {!isBuyer && order.state === 'return_in_transit' && (
          <Button size="sm" className="rounded-full" onClick={() => void actOnOrder(order, 'return.receive', {})}>
            Mark return received
          </Button>
        )}
        {!isBuyer && order.state === 'return_inspection' && (
          <Button size="sm" className="rounded-full" onClick={() => begin('return_inspect')}>
            Inspect return
          </Button>
        )}
        {!isBuyer && ['return_inspection', 'disputed', 'cancelled'].includes(order.state) && !order.externalRefund && (
          <Button size="sm" className="rounded-full" onClick={() => begin('refund')}>
            Record external refund
          </Button>
        )}
        {isBuyer && order.digitalDelivery && (
          <>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() =>
                void actOnOrder(order, 'fulfillment.record_access', {
                  contentHash: order.digitalDelivery?.resourceHash,
                }).then((ok) => {
                  if (ok) {
                    toast({
                      title: 'Digital delivery opened',
                      description: 'Sandbox Locks access recorded and content hash checked.',
                    });
                  }
                })
              }
            >
              Open digital delivery
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={() =>
                void actOnOrder(order, 'fulfillment.refresh_credential', {}).then((ok) => {
                  if (ok) {
                    toast({
                      title: 'Credential refreshed',
                      description: 'A new short-lived sandbox Locks credential was issued.',
                    });
                  }
                })
              }
            >
              Refresh credential
            </Button>
          </>
        )}
        {[
          'paid',
          'processing',
          'shipped',
          'delivered',
          'completed',
          'return_requested',
          'return_in_transit',
          'return_inspection',
        ].includes(order.state) &&
          !order.dispute && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => begin('dispute')}>
              Open dispute
            </Button>
          )}
        {canResolveDispute && order.dispute?.state === 'open' && (
          <Button size="sm" className="rounded-full" onClick={() => begin('dispute_resolve')}>
            Resolve dispute
          </Button>
        )}
        {['delivered', 'completed'].includes(order.state) &&
          !order.reviews?.some(({ reviewerPubky }) =>
            isBuyer ? reviewerPubky === order.buyerPubky : reviewerPubky === order.sellerPubky,
          ) && (
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => begin('review')}>
              Leave review
            </Button>
          )}
        {ownReview && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                action.form.setValue('reviewId', ownReview.id);
                action.form.setValue('rating', String(ownReview.rating));
                action.form.setValue('text', ownReview.text);
                begin('review_edit');
              }}
            >
              Edit review
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                action.form.setValue('reviewId', ownReview.id);
                begin('review_report');
              }}
            >
              Report review
            </Button>
          </>
        )}
        {replyableReview && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              action.form.setValue('reviewId', replyableReview.id);
              begin('review_reply');
            }}
          >
            Reply to review
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{actionTitle(actionType)}</DialogTitle>
          </DialogHeader>
          {actionType === 'exception' && (
            <div className="grid gap-2">
              <Label htmlFor="exceptionCode">Exception type</Label>
              <Controller
                name="exceptionCode"
                control={action.form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="exceptionCode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="refused">Refused</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          {['cancel', 'return', 'dispute', 'exception'].includes(actionType) && (
            <ControlledTextareaField
              name="reason"
              control={action.form.control}
              label="Reason"
              placeholder="Describe what happened"
            />
          )}
          {actionType === 'dispute_resolve' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="disputeResolution">Resolution</Label>
                <Controller
                  name="disputeResolution"
                  control={action.form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="disputeResolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buyer_refund">Buyer refund</SelectItem>
                        <SelectItem value="partial_refund">Partial refund</SelectItem>
                        <SelectItem value="seller_favor">Seller favor</SelectItem>
                        <SelectItem value="replacement">Replacement</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <ControlledTextareaField
                name="reason"
                control={action.form.control}
                label="Rationale"
                placeholder="Explain the decision"
              />
            </>
          )}
          {['ship', 'return_ship'].includes(actionType) && (
            <>
              <ControlledInputField name="carrier" control={action.form.control} label="Carrier" />
              <ControlledInputField name="trackingNumber" control={action.form.control} label="Tracking number" />
            </>
          )}
          {['return', 'refund', 'partial'].includes(actionType) && (
            <ControlledInputField name="amount" control={action.form.control} label="Amount (USD)" />
          )}
          {actionType === 'return_inspect' && (
            <ControlledTextareaField name="reason" control={action.form.control} label="Inspection notes" />
          )}
          {actionType === 'refund' && (
            <ControlledInputField
              name="transactionId"
              control={action.form.control}
              label="External Bitcoin transaction evidence"
            />
          )}
          {['review', 'review_edit'].includes(actionType) && (
            <>
              <ControlledInputField name="rating" control={action.form.control} label="Rating (1–5)" />
              <ControlledInputField name="itemAccuracy" control={action.form.control} label="Item accuracy (1–5)" />
              <ControlledInputField name="shipping" control={action.form.control} label="Shipping (1–5)" />
              <ControlledInputField name="communication" control={action.form.control} label="Communication (1–5)" />
              <ControlledTextareaField name="text" control={action.form.control} label="Review" />
              <ControlledInputField
                name="mediaHashes"
                control={action.form.control}
                label="Optional media hashes"
                placeholder="64-character BLAKE3 hashes"
              />
            </>
          )}
          {actionType === 'review_reply' && (
            <ControlledTextareaField name="text" control={action.form.control} label="Reply" />
          )}
          {actionType === 'review_report' && (
            <ControlledTextareaField name="text" control={action.form.control} label="Why report this review?" />
          )}
          {actionType === 'confirm_address' && (
            <>
              <ControlledInputField name="name" control={action.form.control} label="Recipient name" />
              <ControlledInputField name="line1" control={action.form.control} label="Address" />
              <ControlledInputField name="line2" control={action.form.control} label="Apartment or suite" />
              <ControlledInputField name="city" control={action.form.control} label="City" />
              <ControlledInputField name="region" control={action.form.control} label="Region" />
              <ControlledInputField name="postalCode" control={action.form.control} label="Postal code" />
              <ControlledInputField name="countryCode" control={action.form.control} label="Country code" />
            </>
          )}
          <DialogFooter>
            <Button variant="secondary" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={submit}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function actionTitle(action: MarketplaceOrderActionData['action']): string {
  switch (action) {
    case 'cancel':
      return 'Request cancellation';
    case 'ship':
      return 'Add shipment tracking';
    case 'pickup':
      return 'Mark ready for pickup';
    case 'return':
      return 'Request a return';
    case 'return_ship':
      return 'Add return tracking';
    case 'return_inspect':
      return 'Inspect returned item';
    case 'partial':
      return 'Offer a partial resolution';
    case 'refund':
      return 'Record external refund';
    case 'dispute':
      return 'Open a dispute';
    case 'dispute_resolve':
      return 'Resolve this dispute';
    case 'review':
      return 'Leave a review';
    case 'review_edit':
      return 'Edit review';
    case 'review_reply':
      return 'Reply to review';
    case 'review_report':
      return 'Report this review';
    case 'exception':
      return 'Record delivery exception';
    case 'confirm_address':
      return 'Confirm delivery address';
  }
}
