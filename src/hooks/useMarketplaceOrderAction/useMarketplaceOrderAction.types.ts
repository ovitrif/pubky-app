import { z } from 'zod';

export const marketplaceOrderActionSchema = z
  .object({
    action: z.enum([
      'cancel',
      'ship',
      'pickup',
      'return',
      'partial',
      'refund',
      'dispute',
      'review',
      'review_edit',
      'review_reply',
      'review_report',
    ]),
    reason: z.string().trim().max(2_000),
    carrier: z.string().trim().max(100),
    trackingNumber: z.string().trim().max(200),
    amount: z.string().trim(),
    transactionId: z.string().trim().max(200),
    rating: z.string().trim(),
    text: z.string().trim().max(5_000),
    itemAccuracy: z.string().trim(),
    shipping: z.string().trim(),
    communication: z.string().trim(),
    reviewId: z.string().trim(),
    mediaHashes: z.string().trim(),
    requestedRemedy: z.enum(['refund', 'partial_refund', 'replacement', 'other']),
  })
  .superRefine((data, context) => {
    if (['cancel', 'return', 'dispute'].includes(data.action) && !data.reason) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'Reason is required.' });
    }
    if (data.action === 'ship' && (!data.carrier || !data.trackingNumber)) {
      context.addIssue({ code: 'custom', path: ['trackingNumber'], message: 'Carrier and tracking are required.' });
    }
    if (data.action === 'refund') {
      if (!/^\d+(?:\.\d{1,2})?$/.test(data.amount) || Number(data.amount) <= 0) {
        context.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a valid refund amount.' });
      }
      if (data.transactionId.length < 8) {
        context.addIssue({ code: 'custom', path: ['transactionId'], message: 'Transaction evidence is required.' });
      }
    }
    if (['review', 'review_edit'].includes(data.action) && (!/^[1-5]$/.test(data.rating) || !data.text)) {
      context.addIssue({ code: 'custom', path: ['rating'], message: 'Rating and review text are required.' });
    }
    if (data.action === 'review_edit' && !data.reviewId) {
      context.addIssue({ code: 'custom', path: ['reviewId'], message: 'Review is required.' });
    }
    if (data.action === 'review_reply' && (!data.reviewId || !data.text)) {
      context.addIssue({ code: 'custom', path: ['text'], message: 'Reply text is required.' });
    }
    if (data.action === 'partial') {
      if (!/^\d+(?:\.\d{1,2})?$/.test(data.amount) || Number(data.amount) <= 0) {
        context.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a valid partial amount.' });
      }
    }
    if (data.action === 'review_report' && (!data.reviewId || !data.text)) {
      context.addIssue({ code: 'custom', path: ['text'], message: 'Explain why this review is being reported.' });
    }
  });

export type MarketplaceOrderActionData = z.infer<typeof marketplaceOrderActionSchema>;

export const marketplaceOrderActionDefaults: MarketplaceOrderActionData = {
  action: 'cancel',
  reason: '',
  carrier: '',
  trackingNumber: '',
  amount: '',
  transactionId: '',
  rating: '5',
  text: '',
  itemAccuracy: '5',
  shipping: '5',
  communication: '5',
  reviewId: '',
  mediaHashes: '',
  requestedRemedy: 'refund',
};
