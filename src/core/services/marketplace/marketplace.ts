import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { getCommerceAdapterMode, getMarketplaceUrl } from '@/config/commerce';
import { MARKETPLACE_CSRF_HEADER, MARKETPLACE_CSRF_TOKEN } from '@/libs/commerce/marketplace-http-security';
import { isSafeCommerceServiceUrl } from '@/libs/commerce/safe-outbound-url';
import {
  MARKETPLACE_STEP_UP_HEADER,
  type MarketplaceStepUpPurpose,
  stepUpPurposeForCommand,
} from '@/libs/commerce/step-up';
import {
  type MarketplaceCommand,
  type MarketplaceCommandResponse,
  marketplaceCommandResponseSchema,
} from '@/libs/commerce/transaction-commands';
import { commercePubkySchema } from '@/libs/commerce/transaction-contracts';
import { ClientErrorCode, ServerErrorCode, ValidationErrorCode } from '@/libs/error/error.codes';
import { Err } from '@/libs/error/error.factories';
import { safeFetch } from '@/libs/error/error.http';
import { ErrorService } from '@/libs/error/error.types';
import { parseResponseOrThrow } from '@/libs/http/response.utils';

const listingProjectionSchema = z
  .object({
    aggregateId: z.string(),
    sellerPubky: commercePubkySchema,
    listingId: z.string(),
    serverRevision: z.number().int().positive(),
    state: z.enum(['available', 'reserved', 'sold']),
    availableQuantity: z.number().int().nonnegative(),
    reservedQuantity: z.number().int().nonnegative(),
    unitPrice: z.object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() }),
    saleFormat: z.enum(['fixed_price', 'auction', 'offer']),
    listingRevision: z.number().int().positive().optional(),
    shippingQuoteMinor: z.number().int().min(0).max(10_000_000).nullable().optional(),
    autoAcceptAmount: z
      .object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() })
      .nullable()
      .optional(),
    auction: z
      .object({
        status: z.enum(['scheduled', 'active', 'sold', 'unsold', 'cancelled']).optional(),
        startsAt: z.string(),
        endsAt: z.string(),
        minimumIncrement: z.object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() }),
        currentPrice: z.object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() }),
        minimumNextBid: z
          .object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() })
          .optional(),
        leaderPubky: commercePubkySchema.nullable(),
        bidCount: z.number().int().nonnegative(),
        reserveMet: z.boolean(),
      })
      .passthrough()
      .nullable(),
    visibleBidHistory: z
      .array(
        z.object({
          sequence: z.number().int().positive(),
          bidderPubky: commercePubkySchema,
          visiblePrice: z.object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() }),
          createdAt: z.string(),
        }),
      )
      .optional(),
  })
  .passthrough();

const conversationSchema = z
  .object({
    id: z.string(),
    listingAggregateId: z.string(),
    sellerPubky: commercePubkySchema,
    buyerPubky: commercePubkySchema,
    revision: z.number().int().positive(),
    lastMessageAt: z.string(),
    blockedBy: z.array(commercePubkySchema).optional(),
    messages: z.array(
      z.object({
        id: z.uuid(),
        senderPubky: commercePubkySchema,
        recipientPubky: commercePubkySchema,
        kind: z.enum(['text', 'listing_card', 'offer_card', 'system']).optional(),
        text: z.string(),
        card: z
          .object({
            type: z.enum(['listing', 'offer']),
            listingAggregateId: z.string(),
            listingId: z.string(),
            listingTitle: z.string(),
            sellerPubky: commercePubkySchema,
            offerId: z.string().optional(),
            offerAmountMinor: z.number().int().optional(),
            offerCurrency: z.string().optional(),
            offerState: z.string().optional(),
          })
          .nullable()
          .optional(),
        attachments: z.array(
          z.object({
            id: z.uuid(),
            senderPubky: commercePubkySchema,
            recipientPubky: commercePubkySchema,
            mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
            byteSize: z.number().int().positive(),
            contentHash: z.string().regex(/^[a-f0-9]{64}$/),
            createdAt: z.string(),
          }),
        ),
        createdAt: z.string(),
      }),
    ),
  })
  .passthrough();

const attachmentMetadataSchema = z.object({
  id: z.uuid(),
  senderPubky: commercePubkySchema,
  recipientPubky: commercePubkySchema,
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  byteSize: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string(),
});

const notificationSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    recipientPubky: commercePubkySchema,
    actorPubky: commercePubkySchema,
    type: z.enum([
      'message_received',
      'offer_received',
      'offer_countered',
      'offer_accepted',
      'offer_rejected',
      'outbid',
      'auction_won',
      'auction_ended',
      'order_created',
      'order_address_confirmed',
      'payment_confirmed',
      'order_cancelled',
      'order_shipped',
      'order_delivered',
      'delivery_exception',
      'return_updated',
      'refund_recorded',
      'dispute_updated',
      'review_received',
    ]),
    aggregateId: z.string(),
    createdAt: z.string(),
    readAt: z.string().nullable(),
  })
  .passthrough();

const notificationPreferencesSchema = z.object({
  ownerPubky: commercePubkySchema,
  revision: z.number().int().nonnegative(),
  messages: z.boolean(),
  offers: z.boolean(),
  bids: z.boolean(),
  auctions: z.boolean(),
  updatedAt: z.string(),
});

const offerSchema = z
  .object({
    id: z.uuid(),
    aggregateId: z.string(),
    listingAggregateId: z.string(),
    buyerPubky: commercePubkySchema,
    sellerPubky: commercePubkySchema,
    revision: z.number().int().positive(),
    state: z.enum(['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired']),
    offeredBy: commercePubkySchema,
    amount: z.object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() }),
    quantity: z.number().int().positive(),
    message: z.string(),
    expiresAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const moneySchema = z.object({ amountMinor: z.number().int(), currency: z.string(), exponent: z.number().int() });

const orderSchema = z
  .object({
    id: z.uuid(),
    buyerPubky: commercePubkySchema,
    sellerPubky: commercePubkySchema,
    revision: z.number().int().positive(),
    state: z.enum([
      'pending_payment',
      'paid',
      'processing',
      'ready_for_pickup',
      'shipped',
      'delivered',
      'completed',
      'cancel_requested',
      'cancelled',
      'return_requested',
      'return_in_transit',
      'return_inspection',
      'return_approved',
      'return_received',
      'disputed',
      'refunded_external',
      'closed',
    ]),
    lines: z.array(
      z.object({
        listingAggregateId: z.string(),
        listingRevision: z.number().int().positive(),
        contentHash: z.string(),
        title: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: moneySchema,
        subtotal: moneySchema,
      }),
    ),
    subtotal: moneySchema,
    shipping: moneySchema,
    tax: moneySchema,
    discount: moneySchema.optional(),
    total: moneySchema,
    couponCode: z.string().nullable().optional(),
    payoutState: z.enum(['held', 'released', 'blocked']).optional(),
    guaranteePolicyVersion: z.literal(1),
    origin: z.enum(['checkout', 'auction', 'buy_now', 'offer', 'second_chance']).optional(),
    deliveryAddress: z
      .object({
        name: z.string(),
        line1: z.string(),
        line2: z.string().optional(),
        city: z.string(),
        region: z.string(),
        postalCode: z.string(),
        countryCode: z.string(),
      })
      .nullable()
      .optional(),
    paymentId: z.uuid(),
    receiptId: z.uuid().nullable(),
    cancellationReason: z.string().nullable().optional(),
    shipment: z
      .object({
        carrier: z.string(),
        trackingNumber: z.string(),
        state: z.enum(['ready_for_pickup', 'shipped', 'delivered']),
        shippedAt: z.string(),
        deliveredAt: z.string().nullable(),
        exception: z
          .object({
            code: z.enum(['delayed', 'lost', 'damaged', 'refused']),
            notes: z.string(),
            recordedAt: z.string(),
            actorPubky: commercePubkySchema,
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    fulfillment: z.enum(['physical', 'digital', 'pickup']).optional(),
    inventoryState: z.enum(['reserved', 'sold', 'released']).optional(),
    digitalDelivery: z
      .object({
        credentialId: z.uuid(),
        resourceHash: z.string().regex(/^[a-f0-9]{64}$/),
        issuedAt: z.string(),
        expiresAt: z.string(),
        accessCount: z.number().int().nonnegative(),
        lastAccessAt: z.string().nullable(),
        integrityOk: z.boolean(),
      })
      .nullable()
      .optional(),
    returnRequest: z
      .object({
        state: z.enum([
          'requested',
          'approved',
          'in_transit',
          'inspection',
          'partial_offered',
          'denied',
          'received',
          'refunded',
        ]),
        reason: z.string(),
        requestedAmountMinor: z.number().int().positive(),
        offeredAmountMinor: z.number().int().nonnegative().nullable().optional(),
        requestedAt: z.string(),
        updatedAt: z.string(),
        returnShipment: z
          .object({
            carrier: z.string(),
            trackingNumber: z.string(),
            shippedAt: z.string(),
          })
          .nullable()
          .optional(),
        inspection: z
          .object({
            outcome: z.enum(['pass', 'fail', 'partial']),
            notes: z.string(),
            inspectedAt: z.string(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    externalRefund: z
      .object({ amountMinor: z.number().int().positive(), transactionId: z.string(), recordedAt: z.string() })
      .nullable()
      .optional(),
    dispute: z
      .object({
        state: z.enum(['open', 'resolved']),
        openedBy: commercePubkySchema,
        reason: z.string(),
        requestedRemedy: z.enum(['refund', 'partial_refund', 'replacement', 'other']),
        resolution: z.enum(['buyer_refund', 'partial_refund', 'seller_favor', 'replacement']).nullable(),
        rationale: z.string().nullable(),
        openedAt: z.string(),
        resolvedAt: z.string().nullable(),
      })
      .nullable()
      .optional(),
    reviews: z
      .array(
        z.object({
          id: z.uuid(),
          reviewerPubky: commercePubkySchema,
          subjectPubky: commercePubkySchema,
          rating: z.number().int().min(1).max(5),
          text: z.string(),
          itemAccuracy: z.number().int().min(1).max(5).nullable().optional(),
          shipping: z.number().int().min(1).max(5).nullable().optional(),
          communication: z.number().int().min(1).max(5).nullable().optional(),
          mediaHashes: z.array(z.string()).optional(),
          reply: z.string().nullable().optional(),
          editedAt: z.string().nullable().optional(),
          createdAt: z.string(),
        }),
      )
      .optional(),
    supportNotes: z
      .array(
        z.object({
          id: z.uuid(),
          actorPubky: commercePubkySchema,
          text: z.string(),
          createdAt: z.string(),
        }),
      )
      .optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const paymentSchema = z
  .object({
    id: z.uuid(),
    orderId: z.uuid(),
    buyerPubky: commercePubkySchema,
    sellerPubky: commercePubkySchema,
    revision: z.number().int().positive(),
    adapter: z.literal('sandbox'),
    endpointId: z.enum(['sandbox_paykit_btc', 'sandbox_labeled_invoice']).optional(),
    state: z.enum(['awaiting_entitlement', 'detected', 'confirmed', 'expired', 'manual_review']),
    confirmations: z.number().int().min(0).max(6),
    locksBundleId: z.uuid(),
    amount: moneySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const receiptSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  paymentId: z.uuid(),
  issuerPubky: commercePubkySchema,
  recipientPubky: commercePubkySchema,
  total: moneySchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  issuedAt: z.string(),
});

const reportSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive().optional(),
  reporterPubky: commercePubkySchema,
  targetType: z.enum(['listing', 'user', 'message', 'review']),
  targetId: z.string(),
  reason: z.enum(['prohibited_item', 'counterfeit', 'scam', 'harassment', 'unsafe', 'other']),
  details: z.string(),
  state: z.enum(['open', 'dismissed', 'warned', 'restricted', 'delisted']),
  assignedTo: commercePubkySchema.nullable().optional(),
  assignedAt: z.string().nullable().optional(),
  previousState: z.enum(['open', 'dismissed', 'warned', 'restricted', 'delisted']).nullable().optional(),
  decisionNotes: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

const ledgerEntrySchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  account: z.string(),
  direction: z.enum(['debit', 'credit']),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string(),
  exponent: z.number().int(),
  createdAt: z.string(),
});

const promotionSchema = z.object({
  id: z.uuid(),
  sellerPubky: commercePubkySchema,
  code: z.string(),
  percentOff: z.number().int(),
  usageLimit: z.number().int(),
  usedCount: z.number().int(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

const statementSchema = z.object({
  sellerPubky: commercePubkySchema,
  orders: z.number().int().nonnegative(),
  paidMinor: z.number().int().nonnegative(),
  refundedMinor: z.number().int().nonnegative(),
  heldMinor: z.number().int().nonnegative(),
  releasedMinor: z.number().int().nonnegative(),
  entries: z.array(ledgerEntrySchema),
});

const analyticsSchema = z.object({
  sellerPubky: commercePubkySchema,
  views: z.number().int().nonnegative(),
  favorites: z.number().int().nonnegative(),
  soldQuantity: z.number().int().nonnegative(),
  totalQuantity: z.number().int().nonnegative(),
  sellThroughPercent: z.number().nonnegative(),
  conversionPercent: z.number().nonnegative(),
  paidOrders: z.number().int().nonnegative(),
  toShip: z.number().int().nonnegative(),
  returnsOpen: z.number().int().nonnegative(),
  disputesOpen: z.number().int().nonnegative(),
});

const riskSignalSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  actorPubky: commercePubkySchema,
  signalType: z.enum([
    'auction_manipulation',
    'account_takeover',
    'payment_abuse',
    'refund_abuse',
    'off_platform_scam',
    'suspicious_payout',
  ]),
  targetType: z.enum(['listing', 'user', 'order', 'payment', 'auction']),
  targetId: z.string(),
  details: z.string(),
  createdAt: z.string(),
});

const reputationSchema = z.object({
  sellerPubky: commercePubkySchema,
  reviewCount: z.number().int().nonnegative(),
  averageRating: z.number().nullable(),
  salesCount: z.number().int().nonnegative(),
  itemAccuracy: z.number().nullable(),
  shipping: z.number().nullable(),
  communication: z.number().nullable(),
  responseTimeHours: z.number().nullable().optional(),
});

export type MarketplaceListingProjection = z.infer<typeof listingProjectionSchema>;
export type MarketplaceConversation = z.infer<typeof conversationSchema>;
export type MarketplaceNotification = z.infer<typeof notificationSchema>;
export type MarketplaceOffer = z.infer<typeof offerSchema>;
export type MarketplaceNotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type MarketplaceAttachmentMetadata = z.infer<typeof attachmentMetadataSchema>;
export type MarketplaceOrder = z.infer<typeof orderSchema>;
export type MarketplacePayment = z.infer<typeof paymentSchema>;
export type MarketplaceReceipt = z.infer<typeof receiptSchema>;
export type MarketplaceReport = z.infer<typeof reportSchema>;
export type MarketplaceLedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type MarketplacePromotion = z.infer<typeof promotionSchema>;
export type MarketplaceSellerStatement = z.infer<typeof statementSchema>;
export type MarketplaceSellerAnalytics = z.infer<typeof analyticsSchema>;
export type MarketplaceSellerReputation = z.infer<typeof reputationSchema>;
const enforcementSchema = z.object({
  subjectPubky: commercePubkySchema,
  actions: z.array(z.enum(['warning', 'visibility_limit', 'message_limit', 'transaction_hold', 'suspension', 'ban'])),
  updatedAt: z.string(),
});

export type MarketplaceRiskSignal = z.infer<typeof riskSignalSchema>;
export type MarketplaceEnforcement = z.infer<typeof enforcementSchema>;

const stepUpResponseSchema = z
  .object({
    token: z.string().min(16),
    expiresAt: z.iso.datetime({ offset: true }),
    purpose: z.enum(['moderation', 'risk', 'finance']),
    ttlMs: z.number().int().positive(),
  })
  .strict();

const stepUpTokens = new Map<string, { token: string; expiresAtMs: number }>();

export class MarketplaceGatewayService {
  private constructor() {}

  static clearStepUpCache(): void {
    stepUpTokens.clear();
  }

  static async requestStepUp(
    actor: string,
    purpose: MarketplaceStepUpPurpose,
  ): Promise<z.infer<typeof stepUpResponseSchema>> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/auth/step-up`;
    const response = await safeFetch(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pubky-actor': actor,
          [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
        },
        body: JSON.stringify({ purpose }),
      },
      ErrorService.Marketplace,
      'requestStepUp',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'requestStepUp', url);
    const parsed = stepUpResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid step-up token.', {
        service: ErrorService.Marketplace,
        operation: 'requestStepUp',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async execute(actor: string, command: MarketplaceCommand): Promise<MarketplaceCommandResponse> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/commands`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-pubky-actor': actor,
      [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
    };
    const purpose = stepUpPurposeForCommand(command.kind);
    if (purpose) {
      headers[MARKETPLACE_STEP_UP_HEADER] = await this.ensureStepUp(actor, purpose);
    }
    const response = await safeFetch(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(command),
      },
      ErrorService.Marketplace,
      'execute',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'execute', url);
    const parsed = marketplaceCommandResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid command response.', {
        service: ErrorService.Marketplace,
        operation: 'execute',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getListing(aggregateId: string): Promise<MarketplaceListingProjection | null> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/listings?aggregateId=${encodeURIComponent(aggregateId)}`;
    const response = await safeFetch(url, { method: 'GET' }, ErrorService.Marketplace, 'getListing');
    if (response.status === 404) return null;
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getListing', url);
    const parsed = listingProjectionSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid listing projection.', {
        service: ErrorService.Marketplace,
        operation: 'getListing',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getConversations(actor: string): Promise<MarketplaceConversation[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/conversations`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getConversations',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getConversations', url);
    const parsed = z.object({ conversations: z.array(conversationSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid conversations.', {
        service: ErrorService.Marketplace,
        operation: 'getConversations',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.conversations;
  }

  static async getOffers(actor: string): Promise<MarketplaceOffer[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/offers`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getOffers',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getOffers', url);
    const parsed = z.object({ offers: z.array(offerSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid offers.', {
        service: ErrorService.Marketplace,
        operation: 'getOffers',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.offers;
  }

  static async getNotifications(actor: string): Promise<MarketplaceNotification[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/notifications`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getNotifications',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getNotifications', url);
    const parsed = z.object({ notifications: z.array(notificationSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid notifications.', {
        service: ErrorService.Marketplace,
        operation: 'getNotifications',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.notifications;
  }

  static async getNotificationPreferences(actor: string): Promise<MarketplaceNotificationPreferences> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/notification-preferences`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getNotificationPreferences',
    );
    const raw = await parseResponseOrThrow<unknown>(
      response,
      ErrorService.Marketplace,
      'getNotificationPreferences',
      url,
    );
    const parsed = notificationPreferencesSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid notification preferences.', {
        service: ErrorService.Marketplace,
        operation: 'getNotificationPreferences',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getOrders(actor: string): Promise<MarketplaceOrder[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/orders`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getOrders',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getOrders', url);
    const parsed = z.object({ orders: z.array(orderSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid orders.', {
        service: ErrorService.Marketplace,
        operation: 'getOrders',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.orders;
  }

  static async getPayment(actor: string, paymentId: string): Promise<MarketplacePayment | null> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/payments/${encodeURIComponent(paymentId)}`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getPayment',
    );
    if (response.status === 404) return null;
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getPayment', url);
    const parsed = paymentSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid payment.', {
        service: ErrorService.Marketplace,
        operation: 'getPayment',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getReceipt(actor: string, receiptId: string): Promise<MarketplaceReceipt | null> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/receipts/${encodeURIComponent(receiptId)}`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getReceipt',
    );
    if (response.status === 404) return null;
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getReceipt', url);
    const parsed = receiptSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid receipt.', {
        service: ErrorService.Marketplace,
        operation: 'getReceipt',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getReports(actor: string): Promise<MarketplaceReport[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/reports`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getReports',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getReports', url);
    const parsed = z.object({ reports: z.array(reportSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid moderation reports.', {
        service: ErrorService.Marketplace,
        operation: 'getReports',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.reports;
  }

  static async getRestrictedListingIds(): Promise<string[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/restricted-listings`;
    const response = await safeFetch(url, { method: 'GET' }, ErrorService.Marketplace, 'getRestrictedListingIds');
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getRestrictedListingIds', url);
    const parsed = z.object({ listingIds: z.array(z.string()) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid restricted listings.', {
        service: ErrorService.Marketplace,
        operation: 'getRestrictedListingIds',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.listingIds;
  }

  static async getLedger(actor: string, orderId?: string): Promise<MarketplaceLedgerEntry[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/ledger${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ''}`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getLedger',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getLedger', url);
    const parsed = z.object({ entries: z.array(ledgerEntrySchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid ledger entries.', {
        service: ErrorService.Marketplace,
        operation: 'getLedger',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.entries;
  }

  static async getPromotions(actor: string): Promise<MarketplacePromotion[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/promotions`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getPromotions',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getPromotions', url);
    const parsed = z.object({ promotions: z.array(promotionSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid promotions.', {
        service: ErrorService.Marketplace,
        operation: 'getPromotions',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.promotions;
  }

  static async getBlockedBuyers(actor: string): Promise<string[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/blocked-buyers`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getBlockedBuyers',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getBlockedBuyers', url);
    const parsed = z.object({ buyerPubkys: z.array(z.string()) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid blocked buyers.', {
        service: ErrorService.Marketplace,
        operation: 'getBlockedBuyers',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.buyerPubkys;
  }

  static async getSellerReputation(sellerPubky: string): Promise<MarketplaceSellerReputation> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/reputation?seller=${encodeURIComponent(sellerPubky)}`;
    const response = await safeFetch(url, { method: 'GET' }, ErrorService.Marketplace, 'getSellerReputation');
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getSellerReputation', url);
    const parsed = reputationSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid seller reputation.', {
        service: ErrorService.Marketplace,
        operation: 'getSellerReputation',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getAnalytics(actor: string): Promise<MarketplaceSellerAnalytics> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/analytics`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getAnalytics',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getAnalytics', url);
    const parsed = analyticsSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid seller analytics.', {
        service: ErrorService.Marketplace,
        operation: 'getAnalytics',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getStatement(actor: string): Promise<MarketplaceSellerStatement> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/statements`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getStatement',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getStatement', url);
    const parsed = statementSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned an invalid seller statement.', {
        service: ErrorService.Marketplace,
        operation: 'getStatement',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async uploadAttachment(actor: string, recipient: string, file: File): Promise<MarketplaceAttachmentMetadata> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/attachments`;
    const response = await safeFetch(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-pubky-actor': actor,
          'x-recipient-pubky': recipient,
          [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
        },
        body: file,
      },
      ErrorService.Marketplace,
      'uploadAttachment',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'uploadAttachment', url);
    const parsed = attachmentMetadataSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid attachment metadata.', {
        service: ErrorService.Marketplace,
        operation: 'uploadAttachment',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async fetchAttachment(actor: string, attachmentId: string): Promise<Blob> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/attachments/${encodeURIComponent(attachmentId)}`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'fetchAttachment',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expectedHash = response.headers.get('x-content-hash');
    if (!expectedHash || bytesToHex(blake3(bytes)) !== expectedHash) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace attachment integrity check failed.', {
        service: ErrorService.Marketplace,
        operation: 'fetchAttachment',
        context: { statusCode: response.status },
      });
    }
    return new Blob([bytes], { type: response.headers.get('content-type') ?? 'application/octet-stream' });
  }

  static async getInvariants(actor: string): Promise<{
    unbalancedOrders: string[];
    oversoldListings: string[];
    duplicateAuctionWinners: string[];
    stuckFulfillment: string[];
    reservedOnPaidOrders: string[];
  }> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/invariants`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getInvariants',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getInvariants', url);
    const parsed = z
      .object({
        unbalancedOrders: z.array(z.string()),
        oversoldListings: z.array(z.string()),
        duplicateAuctionWinners: z.array(z.string()),
        stuckFulfillment: z.array(z.string()),
        reservedOnPaidOrders: z.array(z.string()),
      })
      .safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid invariants.', {
        service: ErrorService.Marketplace,
        operation: 'getInvariants',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async searchAdmin(
    actor: string,
    query: string,
  ): Promise<{
    reports: MarketplaceReport[];
    listings: Array<{ aggregateId: string; title?: string }>;
    orders: Array<{ id: string; state: string }>;
    riskSignals?: MarketplaceRiskSignal[];
  }> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/admin/search?q=${encodeURIComponent(query)}`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'searchAdmin',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'searchAdmin', url);
    const parsed = z
      .object({
        reports: z.array(reportSchema),
        listings: z.array(z.object({ aggregateId: z.string(), title: z.string().optional() }).passthrough()),
        orders: z.array(z.object({ id: z.string(), state: z.string() })),
        riskSignals: z.array(riskSignalSchema).optional(),
      })
      .safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid admin search results.', {
        service: ErrorService.Marketplace,
        operation: 'searchAdmin',
        context: { statusCode: response.status },
      });
    }
    return parsed.data;
  }

  static async getRiskSignals(actor: string): Promise<MarketplaceRiskSignal[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/risk-signals`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getRiskSignals',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getRiskSignals', url);
    const parsed = z.object({ signals: z.array(riskSignalSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid risk signals.', {
        service: ErrorService.Marketplace,
        operation: 'getRiskSignals',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.signals;
  }

  static async getEnforcements(actor: string): Promise<MarketplaceEnforcement[]> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/enforcements`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'getEnforcements',
    );
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'getEnforcements', url);
    const parsed = z.object({ enforcements: z.array(enforcementSchema) }).safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Marketplace returned invalid enforcements.', {
        service: ErrorService.Marketplace,
        operation: 'getEnforcements',
        context: { statusCode: response.status },
      });
    }
    return parsed.data.enforcements;
  }

  static async exportAccount(actor: string): Promise<unknown> {
    this.assertSandbox();
    const url = `${getMarketplaceUrl()}/v1/account/export`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { 'x-pubky-actor': actor } },
      ErrorService.Marketplace,
      'exportAccount',
    );
    return parseResponseOrThrow<unknown>(response, ErrorService.Marketplace, 'exportAccount', url);
  }

  private static async ensureStepUp(actor: string, purpose: MarketplaceStepUpPurpose): Promise<string> {
    const cacheKey = `${actor}:${purpose}`;
    const cached = stepUpTokens.get(cacheKey);
    if (cached && cached.expiresAtMs - 15_000 > Date.now()) return cached.token;
    const issued = await this.requestStepUp(actor, purpose);
    stepUpTokens.set(cacheKey, { token: issued.token, expiresAtMs: Date.parse(issued.expiresAt) });
    return issued.token;
  }

  private static assertSandbox(): void {
    if (getCommerceAdapterMode() !== 'sandbox') {
      throw Err.client(ClientErrorCode.BAD_REQUEST, 'Sandbox marketplace commands are disabled.', {
        service: ErrorService.Marketplace,
        operation: 'assertSandbox',
      });
    }
    if (!isSafeCommerceServiceUrl(getMarketplaceUrl())) {
      throw Err.validation(ValidationErrorCode.INVALID_INPUT, 'Marketplace URL is not allowed.', {
        service: ErrorService.Marketplace,
        operation: 'assertSandbox',
        context: { scheme: 'blocked' },
      });
    }
  }
}
