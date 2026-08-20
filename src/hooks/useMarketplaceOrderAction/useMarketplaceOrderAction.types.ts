import { z } from 'zod';

export const marketplaceOrderActionSchema = z
  .object({
    action: z.enum([
      'cancel',
      'ship',
      'pickup',
      'return',
      'return_ship',
      'return_inspect',
      'partial',
      'refund',
      'dispute',
      'review',
      'review_edit',
      'review_reply',
      'review_report',
      'exception',
      'confirm_address',
    ]),
    reason: z.string().trim().max(2_000),
    name: z.string().trim().max(100),
    line1: z.string().trim().max(200),
    line2: z.string().trim().max(200),
    city: z.string().trim().max(100),
    region: z.string().trim().max(100),
    postalCode: z.string().trim().max(32),
    countryCode: z.string().trim().max(2),
    exceptionCode: z.enum(['delayed', 'lost', 'damaged', 'refused']),
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
    if (['cancel', 'return', 'dispute', 'exception'].includes(data.action) && !data.reason) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'Reason is required.' });
    }
    if (['ship', 'return_ship'].includes(data.action) && (!data.carrier || !data.trackingNumber)) {
      context.addIssue({ code: 'custom', path: ['trackingNumber'], message: 'Carrier and tracking are required.' });
    }
    if (data.action === 'return_inspect' && !data.reason) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'Inspection notes are required.' });
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
    if (data.action === 'confirm_address') {
      if (!data.name) context.addIssue({ code: 'custom', path: ['name'], message: 'Recipient name is required.' });
      if (!data.line1) context.addIssue({ code: 'custom', path: ['line1'], message: 'Address is required.' });
      if (!data.city) context.addIssue({ code: 'custom', path: ['city'], message: 'City is required.' });
      if (!data.region) context.addIssue({ code: 'custom', path: ['region'], message: 'Region is required.' });
      if (!data.postalCode) {
        context.addIssue({ code: 'custom', path: ['postalCode'], message: 'Postal code is required.' });
      }
      if (!/^[A-Za-z]{2}$/.test(data.countryCode)) {
        context.addIssue({ code: 'custom', path: ['countryCode'], message: 'Use a two-letter country code.' });
      }
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
  exceptionCode: 'delayed',
  name: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  countryCode: 'US',
};
