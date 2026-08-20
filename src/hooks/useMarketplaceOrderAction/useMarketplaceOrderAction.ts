'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CommerceController } from '@/controllers/commerce/commerce';
import { buildMarketplaceReportAggregateId } from '@/libs/commerce/transaction-commands';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';
import {
  type MarketplaceOrderActionData,
  marketplaceOrderActionDefaults,
  marketplaceOrderActionSchema,
} from './useMarketplaceOrderAction.types';

export function useMarketplaceOrderAction(
  order: MarketplaceOrder,
  actOnOrder: (order: MarketplaceOrder, kind: string, payload: Record<string, unknown>) => Promise<boolean>,
) {
  const form = useForm<MarketplaceOrderActionData>({
    resolver: zodResolver(marketplaceOrderActionSchema),
    defaultValues: marketplaceOrderActionDefaults,
    mode: 'onChange',
  });

  const setAction = (action: MarketplaceOrderActionData['action']) => {
    form.reset({ ...marketplaceOrderActionDefaults, action, amount: (order.total.amountMinor / 100).toFixed(2) });
  };

  const submit = async (): Promise<boolean> => {
    let succeeded = false;
    await form.handleSubmit(async (data) => {
      switch (data.action) {
        case 'cancel':
          succeeded = await actOnOrder(order, 'order.cancel_request', { reason: data.reason });
          break;
        case 'ship':
          succeeded = await actOnOrder(order, 'fulfillment.ship', {
            carrier: data.carrier,
            trackingNumber: data.trackingNumber,
          });
          break;
        case 'pickup':
          succeeded = await actOnOrder(order, 'fulfillment.ready_for_pickup', {});
          break;
        case 'partial':
          succeeded = await actOnOrder(order, 'return.offer_partial', {
            offeredAmountMinor: Math.round(Number(data.amount) * 100),
          });
          break;
        case 'return':
          succeeded = await actOnOrder(order, 'return.request', {
            reason: data.reason,
            requestedAmountMinor: Math.round(Number(data.amount) * 100),
          });
          break;
        case 'return_ship':
          succeeded = await actOnOrder(order, 'return.ship', {
            carrier: data.carrier,
            trackingNumber: data.trackingNumber,
          });
          break;
        case 'return_inspect':
          succeeded = await actOnOrder(order, 'return.inspect', {
            outcome: 'pass',
            notes: data.reason,
          });
          break;
        case 'refund':
          succeeded = await actOnOrder(order, 'refund.record_external', {
            amountMinor: Math.round(Number(data.amount) * 100),
            transactionId: data.transactionId,
          });
          break;
        case 'dispute':
          succeeded = await actOnOrder(order, 'dispute.open', {
            reason: data.reason,
            requestedRemedy: data.requestedRemedy,
          });
          break;
        case 'review':
          succeeded = await actOnOrder(order, 'review.create', {
            rating: Number(data.rating),
            text: data.text,
            itemAccuracy: Number(data.itemAccuracy) || undefined,
            shipping: Number(data.shipping) || undefined,
            communication: Number(data.communication) || undefined,
            mediaHashes: data.mediaHashes
              .split(/[\s,]+/)
              .map((value) => value.trim())
              .filter((value) => /^[a-f0-9]{64}$/.test(value)),
          });
          break;
        case 'review_edit':
          succeeded = await actOnOrder(order, 'review.edit', {
            reviewId: data.reviewId,
            rating: Number(data.rating),
            text: data.text,
            itemAccuracy: Number(data.itemAccuracy) || undefined,
            shipping: Number(data.shipping) || undefined,
            communication: Number(data.communication) || undefined,
          });
          break;
        case 'review_reply':
          succeeded = await actOnOrder(order, 'review.reply', {
            reviewId: data.reviewId,
            text: data.text,
          });
          break;
        case 'review_report': {
          const commandId = crypto.randomUUID();
          const response = await CommerceController.executeMarketplaceCommand({
            version: 1,
            commandId,
            aggregateId: buildMarketplaceReportAggregateId(commandId),
            expectedRevision: 0,
            issuedAt: new Date().toISOString(),
            kind: 'trust.report',
            payload: {
              targetType: 'review',
              targetId: data.reviewId,
              reason: 'other',
              details: data.text || 'Reported marketplace review.',
            },
          });
          succeeded = response.ok;
          break;
        }
      }
    })();
    return succeeded;
  };

  return { form, setAction, submit };
}
