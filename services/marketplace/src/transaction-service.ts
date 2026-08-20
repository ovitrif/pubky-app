import { createHash, randomUUID } from 'node:crypto';
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { MARKETPLACE_SANDBOX_MODERATOR } from '../../../src/libs/commerce/sandbox-actors';
import {
  isSandboxFinance,
  isSandboxModerator,
  isSandboxRisk,
  isSandboxSupport,
  marketplaceSandboxRoleForActor,
} from '../../../src/libs/commerce/sandbox-roles';
import { redactMarketplaceOrderForStaff } from '../../../src/libs/commerce/staff-order';
import {
  MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR,
  MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
  MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
  quoteSandboxCheckoutTotals,
  resolveSandboxOrderFulfillment,
} from '../../../src/libs/commerce/tax-adapter';
import { commercePubkySchema } from '../../../src/libs/commerce/transaction-contracts';
import {
  type AcceptOfferCommand,
  type AddMarketplaceSupportNoteCommand,
  type AdvanceSandboxPaymentCommand,
  type ApproveOrderCancellationCommand,
  type ApproveReturnCommand,
  type AssignMarketplaceReportCommand,
  type BlockBuyerCommand,
  type BlockMarketplaceConversationCommand,
  buildMarketplaceBlockedBuyersAggregateId,
  buildMarketplaceCheckoutAggregateId,
  buildMarketplaceConversationAggregateId,
  buildMarketplaceEnforcementAggregateId,
  buildMarketplaceListingAggregateId,
  buildMarketplaceOfferAggregateId,
  buildMarketplaceOrderAggregateId,
  buildMarketplacePaymentAggregateId,
  buildMarketplacePromotionAggregateId,
  type BuyNowAuctionCommand,
  type CloseAuctionCommand,
  type ConfirmOrderDeliveryCommand,
  type CounterOfferCommand,
  type CreateMarketplaceCheckoutCommand,
  type CreateMarketplaceReportCommand,
  type CreateOfferCommand,
  type CreatePrivateOfferCommand,
  type CreatePromotionCommand,
  type CreateReviewCommand,
  type DecideMarketplaceReportCommand,
  type EditReviewCommand,
  type FlagMarketplaceRiskCommand,
  type HoldMarketplaceRiskCommand,
  type InspectReturnCommand,
  type IssueDigitalCredentialCommand,
  type MarketplaceCommand,
  marketplaceCommandSchema,
  type MarkMarketplaceNotificationReadCommand,
  type OfferPartialReturnCommand,
  type OpenDisputeCommand,
  type PlaceBidCommand,
  type ReadyForPickupCommand,
  type ReceiveReturnCommand,
  type ReconcilePaidInventoryCommand,
  type RecordDigitalAccessCommand,
  type RecordExternalRefundCommand,
  type RefreshDigitalCredentialCommand,
  type ReleaseMarketplaceRiskCommand,
  type RegisterListingCommand,
  type RejectOfferCommand,
  type ReleasePayoutCommand,
  type ReplyReviewCommand,
  type RequestOrderCancellationCommand,
  type RequestReturnCommand,
  type ReserveInventoryCommand,
  type ResolveDisputeCommand,
  type ReverseMarketplaceReportCommand,
  type SendMarketplaceMessageCommand,
  type ShipOrderCommand,
  type ShipReturnCommand,
  type UnblockBuyerCommand,
  type UnwatchListingCommand,
  type UpdateMarketplaceNotificationPreferencesCommand,
  type ViewListingCommand,
  type WatchListingCommand,
  type WithdrawOfferCommand,
} from './contracts';

export interface MarketplaceListingAggregate {
  aggregateId: string;
  sellerPubky: string;
  listingId: string;
  title: string;
  listingRevision: number;
  contentHash: string;
  serverRevision: number;
  state: 'available' | 'reserved' | 'sold';
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  unitPrice: {
    amountMinor: number;
    currency: string;
    exponent: number;
  };
  saleFormat: 'fixed_price' | 'auction' | 'offer';
  offersOpenTo: 'anyone' | 'watchers';
  autoAcceptAmount: MarketplaceListingAggregate['unitPrice'] | null;
  fulfillment: 'physical' | 'digital' | 'pickup';
  shippingQuoteMinor: number | null;
  digitalLock: {
    policyUri: string;
    criterionId: string;
    resourceHash: string;
    minimumConfirmations: number;
  } | null;
  auction: {
    status: 'scheduled' | 'active' | 'sold' | 'unsold' | 'cancelled';
    startsAt: string;
    endsAt: string;
    minimumIncrement: MarketplaceListingAggregate['unitPrice'];
    reservePrice?: MarketplaceListingAggregate['unitPrice'];
    buyNowPrice?: MarketplaceListingAggregate['unitPrice'];
    antiSnipingWindowSeconds: number;
    antiSnipingExtensionSeconds: number;
    currentPrice: MarketplaceListingAggregate['unitPrice'];
    minimumNextBid?: MarketplaceListingAggregate['unitPrice'];
    leaderPubky: string | null;
    bidCount: number;
    reserveMet: boolean;
  } | null;
  restricted: boolean;
  updatedAt: string;
}

export interface MarketplaceReservation {
  id: string;
  aggregateId: string;
  buyerPubky: string;
  quantity: number;
  status: 'active';
  expiresAt: string;
  createdAt: string;
}

export interface MarketplaceOfferHistoryEntry {
  revision: number;
  actorPubky: string;
  action: 'created' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
  amount: MarketplaceListingAggregate['unitPrice'];
  quantity: number;
  message: string;
  occurredAt: string;
}

export interface MarketplaceOffer {
  id: string;
  aggregateId: string;
  listingAggregateId: string;
  buyerPubky: string;
  sellerPubky: string;
  revision: number;
  state: 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  offeredBy: string;
  amount: MarketplaceListingAggregate['unitPrice'];
  quantity: number;
  message: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  history: MarketplaceOfferHistoryEntry[];
}

export interface MarketplaceBid {
  id: string;
  listingAggregateId: string;
  bidderPubky: string;
  maximumAmount: MarketplaceListingAggregate['unitPrice'];
  sequence: number;
  createdAt: string;
}

export interface MarketplaceVisibleBid {
  sequence: number;
  bidderPubky: string;
  visiblePrice: MarketplaceListingAggregate['unitPrice'];
  createdAt: string;
}

export type MarketplacePublicListingProjection = MarketplaceListingAggregate & {
  visibleBidHistory: MarketplaceVisibleBid[];
  viewCount: number;
  watcherCount: number;
};

export interface MarketplaceAttachmentMetadata {
  id: string;
  senderPubky: string;
  recipientPubky: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
  contentHash: string;
  createdAt: string;
}

interface MarketplaceStoredAttachment extends MarketplaceAttachmentMetadata {
  bytes: Uint8Array;
  messageId: string | null;
}

export type MarketplaceMessageKind = 'text' | 'listing_card' | 'offer_card' | 'system';

export interface MarketplaceMessageCard {
  type: 'listing' | 'offer';
  listingAggregateId: string;
  listingId: string;
  listingTitle: string;
  sellerPubky: string;
  offerId?: string;
  offerAmountMinor?: number;
  offerCurrency?: string;
  offerState?: string;
}

export interface MarketplaceMessage {
  id: string;
  conversationId: string;
  listingAggregateId: string;
  senderPubky: string;
  recipientPubky: string;
  kind: MarketplaceMessageKind;
  text: string;
  card: MarketplaceMessageCard | null;
  attachments: MarketplaceAttachmentMetadata[];
  createdAt: string;
}

export interface MarketplaceConversation {
  id: string;
  listingAggregateId: string;
  sellerPubky: string;
  buyerPubky: string;
  revision: number;
  lastMessageAt: string;
  messages: MarketplaceMessage[];
  blockedBy: string[];
}

export type MarketplaceRiskSignalType =
  | 'auction_manipulation'
  | 'account_takeover'
  | 'payment_abuse'
  | 'refund_abuse'
  | 'off_platform_scam'
  | 'suspicious_payout';

export interface MarketplaceRiskSignal {
  id: string;
  revision: number;
  actorPubky: string;
  signalType: MarketplaceRiskSignalType;
  targetType: 'listing' | 'user' | 'order' | 'payment' | 'auction';
  targetId: string;
  details: string;
  createdAt: string;
}

export interface MarketplaceNotification {
  id: string;
  revision: number;
  recipientPubky: string;
  actorPubky: string;
  type:
    | 'message_received'
    | 'offer_received'
    | 'offer_countered'
    | 'offer_accepted'
    | 'offer_rejected'
    | 'outbid'
    | 'auction_won'
    | 'auction_ended'
    | 'order_created'
    | 'payment_confirmed'
    | 'order_cancelled'
    | 'order_shipped'
    | 'order_delivered'
    | 'return_updated'
    | 'refund_recorded'
    | 'dispute_updated'
    | 'review_received';
  aggregateId: string;
  createdAt: string;
  readAt: string | null;
}

export interface MarketplaceNotificationPreferences {
  ownerPubky: string;
  revision: number;
  messages: boolean;
  offers: boolean;
  bids: boolean;
  auctions: boolean;
  updatedAt: string;
}

export interface MarketplaceOrderLine {
  listingAggregateId: string;
  listingRevision: number;
  contentHash: string;
  title: string;
  quantity: number;
  unitPrice: MarketplaceListingAggregate['unitPrice'];
  subtotal: MarketplaceListingAggregate['unitPrice'];
}

export interface MarketplaceDeliveryAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

export interface MarketplaceShipment {
  carrier: string;
  trackingNumber: string;
  state: 'ready_for_pickup' | 'shipped' | 'delivered';
  shippedAt: string;
  deliveredAt: string | null;
}

export interface MarketplaceReturn {
  state: 'requested' | 'approved' | 'in_transit' | 'inspection' | 'partial_offered' | 'denied' | 'refunded';
  reason: string;
  requestedAmountMinor: number;
  offeredAmountMinor: number | null;
  requestedAt: string;
  updatedAt: string;
  returnShipment: { carrier: string; trackingNumber: string; shippedAt: string } | null;
  inspection: { outcome: 'pass' | 'fail' | 'partial'; notes: string; inspectedAt: string } | null;
}

export interface MarketplaceDispute {
  state: 'open' | 'resolved';
  openedBy: string;
  reason: string;
  requestedRemedy: 'refund' | 'partial_refund' | 'replacement' | 'other';
  resolution: 'buyer_refund' | 'partial_refund' | 'seller_favor' | 'replacement' | null;
  rationale: string | null;
  openedAt: string;
  resolvedAt: string | null;
}

export interface MarketplaceReview {
  id: string;
  reviewerPubky: string;
  subjectPubky: string;
  rating: number;
  text: string;
  itemAccuracy: number | null;
  shipping: number | null;
  communication: number | null;
  mediaHashes: string[];
  reply: string | null;
  editedAt: string | null;
  createdAt: string;
}

export interface MarketplaceExternalRefund {
  amountMinor: number;
  transactionId: string;
  recordedAt: string;
}

export interface MarketplaceReport {
  id: string;
  revision: number;
  reporterPubky: string;
  targetType: 'listing' | 'user' | 'message' | 'review';
  targetId: string;
  reason: 'prohibited_item' | 'counterfeit' | 'scam' | 'harassment' | 'unsafe' | 'other';
  details: string;
  state: 'open' | 'dismissed' | 'warned' | 'restricted' | 'delisted';
  assignedTo: string | null;
  assignedAt: string | null;
  previousState: 'open' | 'dismissed' | 'warned' | 'restricted' | 'delisted' | null;
  decisionNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export type MarketplaceEnforcementAction =
  | 'warning'
  | 'visibility_limit'
  | 'message_limit'
  | 'transaction_hold'
  | 'suspension'
  | 'ban';

export interface MarketplaceEnforcement {
  subjectPubky: string;
  actions: MarketplaceEnforcementAction[];
  updatedAt: string;
}

export interface MarketplacePromotion {
  id: string;
  sellerPubky: string;
  code: string;
  percentOff: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface MarketplaceLedgerEntry {
  id: string;
  orderId: string;
  account:
    | 'buyer_receivable'
    | 'item_revenue'
    | 'shipping_revenue'
    | 'tax_liability'
    | 'discount'
    | 'cash_sandbox'
    | 'payout_hold'
    | 'seller_payable'
    | 'refund_expense'
    | 'external_refund_clearing';
  direction: 'debit' | 'credit';
  amountMinor: number;
  currency: string;
  exponent: number;
  createdAt: string;
}

export interface MarketplaceOrder {
  id: string;
  buyerPubky: string;
  sellerPubky: string;
  revision: number;
  state:
    | 'pending_payment'
    | 'paid'
    | 'processing'
    | 'ready_for_pickup'
    | 'shipped'
    | 'delivered'
    | 'completed'
    | 'cancel_requested'
    | 'cancelled'
    | 'return_requested'
    | 'return_in_transit'
    | 'return_inspection'
    | 'disputed'
    | 'refunded_external'
    | 'closed';
  lines: MarketplaceOrderLine[];
  deliveryAddress: MarketplaceDeliveryAddress;
  subtotal: MarketplaceListingAggregate['unitPrice'];
  shipping: MarketplaceListingAggregate['unitPrice'];
  tax: MarketplaceListingAggregate['unitPrice'];
  discount: MarketplaceListingAggregate['unitPrice'];
  total: MarketplaceListingAggregate['unitPrice'];
  couponCode: string | null;
  payoutState: 'held' | 'released' | 'blocked';
  guaranteePolicyVersion: 1;
  paymentId: string;
  receiptId: string | null;
  cancellationReason: string | null;
  shipment: MarketplaceShipment | null;
  returnRequest: MarketplaceReturn | null;
  dispute: MarketplaceDispute | null;
  externalRefund: MarketplaceExternalRefund | null;
  reviews: MarketplaceReview[];
  fulfillment: 'physical' | 'digital' | 'pickup';
  digitalDelivery: MarketplaceDigitalDelivery | null;
  inventoryState: 'reserved' | 'sold' | 'released';
  taxAdapterVersion: string;
  shippingAdapterVersion: string;
  supportNotes: MarketplaceSupportNote[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceSupportNote {
  id: string;
  actorPubky: string;
  text: string;
  createdAt: string;
}

export interface MarketplaceDigitalDelivery {
  credentialId: string;
  resourceHash: string;
  issuedAt: string;
  expiresAt: string;
  accessCount: number;
  lastAccessAt: string | null;
  integrityOk: boolean;
}

export interface MarketplacePayment {
  id: string;
  orderId: string;
  buyerPubky: string;
  sellerPubky: string;
  revision: number;
  adapter: 'sandbox';
  endpointId: 'sandbox_paykit_btc' | 'sandbox_labeled_invoice';
  state: 'awaiting_entitlement' | 'detected' | 'confirmed' | 'expired' | 'manual_review';
  confirmations: number;
  locksBundleId: string;
  amount: MarketplaceListingAggregate['unitPrice'];
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceReceipt {
  id: string;
  orderId: string;
  paymentId: string;
  issuerPubky: string;
  recipientPubky: string;
  total: MarketplaceListingAggregate['unitPrice'];
  contentHash: string;
  issuedAt: string;
}

export interface MarketplaceEvent {
  id: string;
  commandId: string;
  aggregateId: string;
  revision: number;
  actorPubky: string;
  kind:
    | 'listing.registered'
    | 'listing.watched'
    | 'listing.unwatched'
    | 'listing.viewed'
    | 'inventory.reserved'
    | 'inventory.reconciled'
    | 'offer.created'
    | 'offer.created_private'
    | 'offer.countered'
    | 'offer.accepted'
    | 'offer.rejected'
    | 'offer.withdrawn'
    | 'auction.bid_placed'
    | 'message.sent'
    | 'auction.closed_sold'
    | 'auction.closed_unsold'
    | 'auction.buy_now'
    | 'notification.read'
    | 'notification.preferences_updated'
    | 'order.created'
    | 'payment.detected'
    | 'payment.confirmed'
    | 'payment.expired'
    | 'payment.manual_review'
    | 'receipt.issued'
    | 'order.cancel_requested'
    | 'order.cancelled'
    | 'fulfillment.shipped'
    | 'fulfillment.ready_for_pickup'
    | 'fulfillment.delivered'
    | 'return.requested'
    | 'return.approved'
    | 'return.shipped'
    | 'return.partial_offered'
    | 'return.received'
    | 'return.inspected'
    | 'fulfillment.credential_issued'
    | 'fulfillment.credential_refreshed'
    | 'fulfillment.access_recorded'
    | 'refund.recorded_external'
    | 'dispute.opened'
    | 'dispute.resolved'
    | 'review.created'
    | 'review.edited'
    | 'review.replied'
    | 'promotion.created'
    | 'payout.released'
    | 'trust.reported'
    | 'trust.decided'
    | 'trust.assigned'
    | 'trust.reversed'
    | 'trust.risk_flagged'
    | 'support.noted'
    | 'risk.held'
    | 'risk.released'
    | 'message.blocked'
    | 'buyer.blocked'
    | 'buyer.unblocked'
    | 'ledger.posted';
  occurredAt: string;
}

export type MarketplaceCommandSuccess = {
  ok: true;
  version: 1;
  commandId: string;
  aggregateId: string;
  revision: number;
  eventIds: string[];
  result:
    | { kind: 'listing'; listing: MarketplaceListingAggregate }
    | { kind: 'watch'; listingAggregateId: string; watcherPubky: string; watching: boolean }
    | { kind: 'view'; listingAggregateId: string; viewCount: number; counted: boolean }
    | { kind: 'reservation'; listing: MarketplaceListingAggregate; reservation: MarketplaceReservation }
    | { kind: 'offer'; offer: MarketplaceOffer }
    | {
        kind: 'bid';
        listing: MarketplaceListingAggregate;
        bid: MarketplaceBid;
      }
    | {
        kind: 'message';
        conversation: MarketplaceConversation;
        message: MarketplaceMessage;
      }
    | {
        kind: 'accepted_offer';
        offer: MarketplaceOffer;
        listing: MarketplaceListingAggregate;
        reservation: MarketplaceReservation;
      }
    | {
        kind: 'auction_result';
        outcome: 'sold' | 'unsold';
        winnerPubky: string | null;
        listing: MarketplaceListingAggregate;
        reservation: MarketplaceReservation | null;
      }
    | { kind: 'notification'; notification: MarketplaceNotification }
    | { kind: 'notification_preferences'; preferences: MarketplaceNotificationPreferences }
    | { kind: 'checkout'; orders: MarketplaceOrder[]; payments: MarketplacePayment[] }
    | {
        kind: 'payment';
        payment: MarketplacePayment;
        order: MarketplaceOrder;
        receipt: MarketplaceReceipt | null;
      }
    | { kind: 'order'; order: MarketplaceOrder }
    | { kind: 'review'; order: MarketplaceOrder; review: MarketplaceReview }
    | { kind: 'promotion'; promotion: MarketplacePromotion }
    | { kind: 'report'; report: MarketplaceReport }
    | { kind: 'blocked_buyer'; sellerPubky: string; buyerPubky: string; blocked: boolean }
    | { kind: 'conversation'; conversation: MarketplaceConversation }
    | { kind: 'risk_signal'; signal: MarketplaceRiskSignal }
    | { kind: 'enforcement'; enforcement: MarketplaceEnforcement }
    | {
        kind: 'inventory_reconcile';
        convertedOrderIds: string[];
        skippedOrderIds: string[];
        failedOrderIds: string[];
      };
};

export type MarketplaceCommandFailure = {
  ok: false;
  error: {
    code:
      | 'INVALID_COMMAND'
      | 'UNAUTHORIZED'
      | 'NOT_FOUND'
      | 'REVISION_CONFLICT'
      | 'IDEMPOTENCY_CONFLICT'
      | 'INSUFFICIENT_INVENTORY'
      | 'INVARIANT_VIOLATION'
      | 'OFFER_EXPIRED'
      | 'INVALID_STATE'
      | 'AUCTION_CLOSED'
      | 'BID_TOO_LOW';
    message: string;
    currentRevision?: number;
    issues?: Array<{ path: string; message: string }>;
  };
};

export type MarketplaceCommandResult = MarketplaceCommandSuccess | MarketplaceCommandFailure;

export type MarketplaceAttachmentStoreResult =
  | { ok: true; attachment: MarketplaceAttachmentMetadata }
  | { ok: false; code: 'INVALID_ATTACHMENT' | 'UNAUTHORIZED'; message: string };

export {
  MARKETPLACE_SANDBOX_FINANCE,
  MARKETPLACE_SANDBOX_MODERATOR,
  MARKETPLACE_SANDBOX_RISK,
  MARKETPLACE_SANDBOX_SUPPORT,
} from '../../../src/libs/commerce/sandbox-actors';

type StoredCommand = {
  requestHash: string;
  result: MarketplaceCommandSuccess;
};

export type MarketplaceRepositorySnapshot = {
  listings: MarketplaceListingAggregate[];
  reservations: MarketplaceReservation[];
  offers: MarketplaceOffer[];
  bids: MarketplaceBid[];
  conversations: MarketplaceConversation[];
  notifications: MarketplaceNotification[];
  notificationPreferences: MarketplaceNotificationPreferences[];
  attachments: Array<{
    id: string;
    senderPubky: string;
    recipientPubky: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    byteSize: number;
    contentHash: string;
    createdAt: string;
    messageId: string | null;
    bytesBase64: string;
  }>;
  orders: MarketplaceOrder[];
  payments: MarketplacePayment[];
  receipts: MarketplaceReceipt[];
  reports: MarketplaceReport[];
  promotions: MarketplacePromotion[];
  blockedBuyers: Array<{ sellerPubky: string; buyerPubkys: string[] }>;
  riskSignals: MarketplaceRiskSignal[];
  watches: Array<{ listingAggregateId: string; watcherPubkys: string[] }>;
  views: Array<{ listingAggregateId: string; viewerPubkys: string[] }>;
  ledger: MarketplaceLedgerEntry[];
  commands: Array<{ key: string; stored: StoredCommand }>;
  events: MarketplaceEvent[];
  enforcements: MarketplaceEnforcement[];
};

export class InMemoryMarketplaceRepository {
  private listings = new Map<string, MarketplaceListingAggregate>();
  private reservations = new Map<string, MarketplaceReservation>();
  private offers = new Map<string, MarketplaceOffer>();
  private bids = new Map<string, MarketplaceBid[]>();
  private conversations = new Map<string, MarketplaceConversation>();
  private notifications: MarketplaceNotification[] = [];
  private notificationPreferences = new Map<string, MarketplaceNotificationPreferences>();
  private attachments = new Map<string, MarketplaceStoredAttachment>();
  private orders = new Map<string, MarketplaceOrder>();
  private payments = new Map<string, MarketplacePayment>();
  private receipts = new Map<string, MarketplaceReceipt>();
  private reports = new Map<string, MarketplaceReport>();
  private promotions = new Map<string, MarketplacePromotion>();
  private blockedBuyers = new Map<string, Set<string>>();
  private riskSignals = new Map<string, MarketplaceRiskSignal>();
  private watches = new Map<string, Set<string>>();
  private views = new Map<string, string[]>();
  private enforcements = new Map<string, MarketplaceEnforcement>();
  private ledger: MarketplaceLedgerEntry[] = [];
  private commands = new Map<string, StoredCommand>();
  private events: MarketplaceEvent[] = [];
  private lockTail: Promise<void> = Promise.resolve();

  async transaction<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.lockTail;
    let release = (): void => {};
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  getListing(id: string): MarketplaceListingAggregate | undefined {
    return this.listings.get(id);
  }

  putListing(listing: MarketplaceListingAggregate): void {
    this.listings.set(listing.aggregateId, listing);
  }

  putReservation(reservation: MarketplaceReservation): void {
    this.reservations.set(reservation.id, reservation);
  }

  getOffer(id: string): MarketplaceOffer | undefined {
    return this.offers.get(id);
  }

  putOffer(offer: MarketplaceOffer): void {
    this.offers.set(offer.id, offer);
  }

  getOffersForListing(listingAggregateId: string): MarketplaceOffer[] {
    return [...this.offers.values()].filter((offer) => offer.listingAggregateId === listingAggregateId);
  }

  getOffersForActor(actorPubky: string): MarketplaceOffer[] {
    return [...this.offers.values()].filter(
      (offer) => offer.buyerPubky === actorPubky || offer.sellerPubky === actorPubky,
    );
  }

  putBid(bid: MarketplaceBid): void {
    const current = this.bids.get(bid.listingAggregateId) ?? [];
    this.bids.set(bid.listingAggregateId, [...current, bid]);
  }

  getBidsForListing(listingAggregateId: string): MarketplaceBid[] {
    return [...(this.bids.get(listingAggregateId) ?? [])];
  }

  getConversation(id: string): MarketplaceConversation | undefined {
    return this.conversations.get(id);
  }

  putConversation(conversation: MarketplaceConversation): void {
    this.conversations.set(conversation.id, conversation);
  }

  getConversationsForActor(actorPubky: string): MarketplaceConversation[] {
    return [...this.conversations.values()].filter(
      (conversation) => conversation.sellerPubky === actorPubky || conversation.buyerPubky === actorPubky,
    );
  }

  appendNotification(notification: MarketplaceNotification): void {
    this.notifications.push(notification);
  }

  getNotification(id: string): MarketplaceNotification | undefined {
    return this.notifications.find((notification) => notification.id === id);
  }

  putNotification(notification: MarketplaceNotification): void {
    this.notifications = this.notifications.map((current) => (current.id === notification.id ? notification : current));
  }

  getNotificationsForActor(actorPubky: string): MarketplaceNotification[] {
    return this.notifications
      .filter(({ recipientPubky }) => recipientPubky === actorPubky)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getNotificationPreferences(actorPubky: string): MarketplaceNotificationPreferences | undefined {
    return this.notificationPreferences.get(actorPubky);
  }

  putNotificationPreferences(preferences: MarketplaceNotificationPreferences): void {
    this.notificationPreferences.set(preferences.ownerPubky, preferences);
  }

  putAttachment(attachment: MarketplaceStoredAttachment): void {
    this.attachments.set(attachment.id, attachment);
  }

  getAttachment(id: string): MarketplaceStoredAttachment | undefined {
    return this.attachments.get(id);
  }

  putOrder(order: MarketplaceOrder): void {
    this.orders.set(order.id, order);
  }

  getOrder(id: string): MarketplaceOrder | undefined {
    return this.orders.get(id);
  }

  getOrdersForActor(actorPubky: string): MarketplaceOrder[] {
    return [...this.orders.values()]
      .filter((order) => order.buyerPubky === actorPubky || order.sellerPubky === actorPubky)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  putPayment(payment: MarketplacePayment): void {
    this.payments.set(payment.id, payment);
  }

  getPayment(id: string): MarketplacePayment | undefined {
    return this.payments.get(id);
  }

  putReceipt(receipt: MarketplaceReceipt): void {
    this.receipts.set(receipt.id, receipt);
  }

  getReceipt(id: string): MarketplaceReceipt | undefined {
    return this.receipts.get(id);
  }

  putReport(report: MarketplaceReport): void {
    this.reports.set(report.id, report);
  }

  getReports(): MarketplaceReport[] {
    return [...this.reports.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  putRiskSignal(signal: MarketplaceRiskSignal): void {
    this.riskSignals.set(signal.id, signal);
  }

  getRiskSignals(): MarketplaceRiskSignal[] {
    return [...this.riskSignals.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  isWatching(listingAggregateId: string, watcherPubky: string): boolean {
    return this.watches.get(listingAggregateId)?.has(watcherPubky) ?? false;
  }

  setWatching(listingAggregateId: string, watcherPubky: string, watching: boolean): void {
    const current = this.watches.get(listingAggregateId) ?? new Set<string>();
    if (watching) current.add(watcherPubky);
    else current.delete(watcherPubky);
    this.watches.set(listingAggregateId, current);
  }

  getWatcherCount(listingAggregateId: string): number {
    return this.watches.get(listingAggregateId)?.size ?? 0;
  }

  recordView(listingAggregateId: string, viewerPubky: string): void {
    const current = this.views.get(listingAggregateId) ?? [];
    current.push(viewerPubky);
    this.views.set(listingAggregateId, current);
  }

  getViewCount(listingAggregateId: string): number {
    return this.views.get(listingAggregateId)?.length ?? 0;
  }

  getReport(id: string): MarketplaceReport | undefined {
    return this.reports.get(id);
  }

  putPromotion(promotion: MarketplacePromotion): void {
    this.promotions.set(promotion.id, promotion);
  }

  getPromotion(sellerPubky: string, code: string): MarketplacePromotion | undefined {
    return [...this.promotions.values()].find(
      (promotion) => promotion.sellerPubky === sellerPubky && promotion.code === code,
    );
  }

  getPromotionsForSeller(sellerPubky: string): MarketplacePromotion[] {
    return [...this.promotions.values()].filter((promotion) => promotion.sellerPubky === sellerPubky);
  }

  isBuyerBlocked(sellerPubky: string, buyerPubky: string): boolean {
    return this.blockedBuyers.get(sellerPubky)?.has(buyerPubky) ?? false;
  }

  setBuyerBlocked(sellerPubky: string, buyerPubky: string, blocked: boolean): void {
    const current = this.blockedBuyers.get(sellerPubky) ?? new Set<string>();
    if (blocked) current.add(buyerPubky);
    else current.delete(buyerPubky);
    this.blockedBuyers.set(sellerPubky, current);
  }

  getBlockedBuyers(sellerPubky: string): string[] {
    return [...(this.blockedBuyers.get(sellerPubky) ?? [])].sort();
  }

  appendLedger(entries: MarketplaceLedgerEntry[]): void {
    this.ledger.push(...entries);
  }

  getLedgerForOrder(orderId: string): MarketplaceLedgerEntry[] {
    return this.ledger.filter((entry) => entry.orderId === orderId);
  }

  getLedgerForActor(actorPubky: string): MarketplaceLedgerEntry[] {
    const orderIds = new Set(
      [...this.orders.values()]
        .filter((order) => order.buyerPubky === actorPubky || order.sellerPubky === actorPubky)
        .map((order) => order.id),
    );
    return this.ledger.filter((entry) => orderIds.has(entry.orderId));
  }

  getRestrictedListingIds(): string[] {
    return [...this.listings.values()].filter((listing) => listing.restricted).map((listing) => listing.aggregateId);
  }

  getStoredCommand(actorPubky: string, commandId: string): StoredCommand | undefined {
    return this.commands.get(`${actorPubky}:${commandId}`);
  }

  putStoredCommand(actorPubky: string, commandId: string, stored: StoredCommand): void {
    this.commands.set(`${actorPubky}:${commandId}`, stored);
  }

  appendEvent(event: MarketplaceEvent): void {
    this.events.push(event);
  }

  getEvents(): MarketplaceEvent[] {
    return [...this.events];
  }

  listListings(): MarketplaceListingAggregate[] {
    return [...this.listings.values()];
  }

  getEnforcement(subjectPubky: string): MarketplaceEnforcement | undefined {
    return this.enforcements.get(subjectPubky);
  }

  putEnforcement(enforcement: MarketplaceEnforcement): void {
    this.enforcements.set(enforcement.subjectPubky, enforcement);
  }

  listEnforcements(): MarketplaceEnforcement[] {
    return [...this.enforcements.values()];
  }

  exportSnapshot(): MarketplaceRepositorySnapshot {
    return {
      listings: [...this.listings.values()],
      reservations: [...this.reservations.values()],
      offers: [...this.offers.values()],
      bids: [...this.bids.values()].flat(),
      conversations: [...this.conversations.values()],
      notifications: [...this.notifications],
      notificationPreferences: [...this.notificationPreferences.values()],
      attachments: [...this.attachments.values()].map((attachment) => ({
        id: attachment.id,
        senderPubky: attachment.senderPubky,
        recipientPubky: attachment.recipientPubky,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        contentHash: attachment.contentHash,
        createdAt: attachment.createdAt,
        messageId: attachment.messageId,
        bytesBase64: Buffer.from(attachment.bytes).toString('base64'),
      })),
      orders: [...this.orders.values()],
      payments: [...this.payments.values()],
      receipts: [...this.receipts.values()],
      reports: [...this.reports.values()],
      promotions: [...this.promotions.values()],
      blockedBuyers: [...this.blockedBuyers.entries()].map(([sellerPubky, buyerPubkys]) => ({
        sellerPubky,
        buyerPubkys: [...buyerPubkys],
      })),
      riskSignals: [...this.riskSignals.values()],
      watches: [...this.watches.entries()].map(([listingAggregateId, watcherPubkys]) => ({
        listingAggregateId,
        watcherPubkys: [...watcherPubkys],
      })),
      views: [...this.views.entries()].map(([listingAggregateId, viewerPubkys]) => ({
        listingAggregateId,
        viewerPubkys,
      })),
      ledger: [...this.ledger],
      commands: [...this.commands.entries()].map(([key, stored]) => ({ key, stored })),
      events: [...this.events],
      enforcements: [...this.enforcements.values()],
    };
  }

  hydrateSnapshot(snapshot: MarketplaceRepositorySnapshot): void {
    this.listings = new Map(
      snapshot.listings.map((listing) => [
        listing.aggregateId,
        {
          ...listing,
          fulfillment: listing.fulfillment ?? 'physical',
          shippingQuoteMinor: listing.shippingQuoteMinor ?? null,
          digitalLock: listing.digitalLock ?? null,
          offersOpenTo: listing.offersOpenTo ?? 'anyone',
          autoAcceptAmount: listing.autoAcceptAmount ?? null,
        },
      ]),
    );
    this.reservations = new Map(snapshot.reservations.map((reservation) => [reservation.id, reservation]));
    this.offers = new Map(snapshot.offers.map((offer) => [offer.id, offer]));
    const bids = new Map<string, MarketplaceBid[]>();
    for (const bid of snapshot.bids) {
      bids.set(bid.listingAggregateId, [...(bids.get(bid.listingAggregateId) ?? []), bid]);
    }
    this.bids = bids;
    this.conversations = new Map(
      snapshot.conversations.map((conversation) => [
        conversation.id,
        {
          ...conversation,
          blockedBy: conversation.blockedBy ?? [],
          messages: conversation.messages.map((message) => ({
            ...message,
            kind: message.kind ?? 'text',
            card: message.card ?? null,
          })),
        },
      ]),
    );
    this.notifications = [...snapshot.notifications];
    this.notificationPreferences = new Map(
      snapshot.notificationPreferences.map((preferences) => [preferences.ownerPubky, preferences]),
    );
    this.attachments = new Map(
      snapshot.attachments.map((attachment) => [
        attachment.id,
        {
          id: attachment.id,
          senderPubky: attachment.senderPubky,
          recipientPubky: attachment.recipientPubky,
          mimeType: attachment.mimeType,
          byteSize: attachment.byteSize,
          contentHash: attachment.contentHash,
          createdAt: attachment.createdAt,
          messageId: attachment.messageId,
          bytes: new Uint8Array(Buffer.from(attachment.bytesBase64, 'base64')),
        },
      ]),
    );
    this.orders = new Map(
      snapshot.orders.map((order) => [
        order.id,
        {
          ...order,
          state: normalizeHydratedOrderState(order.state),
          fulfillment: order.fulfillment ?? 'physical',
          digitalDelivery: order.digitalDelivery ?? null,
          inventoryState: order.inventoryState ?? inferHydratedInventoryState(order.state),
          taxAdapterVersion: order.taxAdapterVersion ?? MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
          shippingAdapterVersion: order.shippingAdapterVersion ?? MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
          supportNotes: order.supportNotes ?? [],
          returnRequest: order.returnRequest
            ? {
                ...order.returnRequest,
                returnShipment: order.returnRequest.returnShipment ?? null,
                inspection: order.returnRequest.inspection ?? null,
              }
            : null,
        },
      ]),
    );
    this.payments = new Map(snapshot.payments.map((payment) => [payment.id, payment]));
    this.receipts = new Map(snapshot.receipts.map((receipt) => [receipt.id, receipt]));
    this.reports = new Map(snapshot.reports.map((report) => [report.id, report]));
    this.promotions = new Map(snapshot.promotions.map((promotion) => [promotion.id, promotion]));
    this.blockedBuyers = new Map(
      snapshot.blockedBuyers.map(({ sellerPubky, buyerPubkys }) => [sellerPubky, new Set(buyerPubkys)]),
    );
    this.riskSignals = new Map((snapshot.riskSignals ?? []).map((signal) => [signal.id, signal]));
    this.watches = new Map(
      (snapshot.watches ?? []).map(({ listingAggregateId, watcherPubkys }) => [
        listingAggregateId,
        new Set(watcherPubkys),
      ]),
    );
    this.views = new Map(
      (snapshot.views ?? []).map(({ listingAggregateId, viewerPubkys }) => [listingAggregateId, [...viewerPubkys]]),
    );
    this.ledger = [...snapshot.ledger];
    this.commands = new Map(snapshot.commands.map(({ key, stored }) => [key, stored]));
    this.events = [...snapshot.events];
    this.enforcements = new Map(
      (snapshot.enforcements ?? []).map((enforcement) => [enforcement.subjectPubky, enforcement]),
    );
  }
}

export class MarketplaceTransactionService {
  constructor(
    private readonly repository: InMemoryMarketplaceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getListingProjection(aggregateId: string): MarketplacePublicListingProjection | undefined {
    const listing = this.repository.getListing(aggregateId);
    if (!listing) return undefined;
    return {
      ...listing,
      auction: listing.auction
        ? {
            ...listing.auction,
            minimumNextBid: {
              ...listing.auction.currentPrice,
              amountMinor: listing.auction.currentPrice.amountMinor + 1,
            },
          }
        : null,
      visibleBidHistory: listing.auction
        ? reconstructVisibleBidHistory(
            listing.unitPrice,
            listing.auction.minimumIncrement,
            this.repository.getBidsForListing(listing.aggregateId),
          )
        : [],
      viewCount: this.repository.getViewCount(listing.aggregateId),
      watcherCount: this.repository.getWatcherCount(listing.aggregateId),
    };
  }

  getParticipantOffers(actorPubky: string, listingAggregateId: string): MarketplaceOffer[] {
    return this.repository
      .getOffersForListing(listingAggregateId)
      .filter((offer) => offer.buyerPubky === actorPubky || offer.sellerPubky === actorPubky);
  }

  getOffers(actorPubky: string): MarketplaceOffer[] {
    return this.repository.getOffersForActor(actorPubky);
  }

  getParticipantConversations(actorPubky: string): MarketplaceConversation[] {
    return this.repository.getConversationsForActor(actorPubky);
  }

  getNotifications(actorPubky: string): MarketplaceNotification[] {
    return this.repository.getNotificationsForActor(actorPubky);
  }

  getNotificationPreferences(actorPubky: string): MarketplaceNotificationPreferences {
    return (
      this.repository.getNotificationPreferences(actorPubky) ?? {
        ownerPubky: actorPubky,
        revision: 0,
        messages: true,
        offers: true,
        bids: true,
        auctions: true,
        updatedAt: this.now().toISOString(),
      }
    );
  }

  storeAttachment(
    actorPubky: string,
    recipientPubky: string,
    mimeType: string,
    bytes: Uint8Array,
  ): MarketplaceAttachmentStoreResult {
    if (!commercePubkySchema.safeParse(actorPubky).success || !commercePubkySchema.safeParse(recipientPubky).success) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Valid attachment participants are required.' };
    }
    if (actorPubky === recipientPubky) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Attachment participants must differ.' };
    }
    if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024 || !hasImageSignature(mimeType, bytes)) {
      return { ok: false, code: 'INVALID_ATTACHMENT', message: 'Attachment must be a valid JPEG, PNG, or WebP.' };
    }
    const attachment: MarketplaceStoredAttachment = {
      id: randomUUID(),
      senderPubky: actorPubky,
      recipientPubky,
      mimeType: mimeType as MarketplaceAttachmentMetadata['mimeType'],
      byteSize: bytes.byteLength,
      contentHash: bytesToHex(blake3(bytes)),
      createdAt: this.now().toISOString(),
      bytes,
      messageId: null,
    };
    this.repository.putAttachment(attachment);
    return { ok: true, attachment: toAttachmentMetadata(attachment) };
  }

  getAttachment(actorPubky: string, attachmentId: string): MarketplaceStoredAttachment | null {
    const attachment = this.repository.getAttachment(attachmentId);
    if (!attachment) return null;
    return attachment.senderPubky === actorPubky || attachment.recipientPubky === actorPubky ? attachment : null;
  }

  getOrders(actorPubky: string): MarketplaceOrder[] {
    if (isSandboxSupport(actorPubky) || isSandboxFinance(actorPubky)) {
      return this.repository
        .exportSnapshot()
        .orders.map((order) =>
          redactMarketplaceOrderForStaff(order, { keepRefundEvidence: isSandboxFinance(actorPubky) }),
        );
    }
    return this.repository.getOrdersForActor(actorPubky);
  }

  getPayment(actorPubky: string, paymentId: string): MarketplacePayment | null {
    const payment = this.repository.getPayment(paymentId);
    return payment && (payment.buyerPubky === actorPubky || payment.sellerPubky === actorPubky) ? payment : null;
  }

  getReceipt(actorPubky: string, receiptId: string): MarketplaceReceipt | null {
    const receipt = this.repository.getReceipt(receiptId);
    return receipt && (receipt.recipientPubky === actorPubky || receipt.issuerPubky === actorPubky) ? receipt : null;
  }

  getReports(actorPubky: string): MarketplaceReport[] {
    return isSandboxModerator(actorPubky) ? this.repository.getReports() : [];
  }

  getRiskSignals(actorPubky: string): MarketplaceRiskSignal[] {
    const signals = this.repository.getRiskSignals();
    return isSandboxModerator(actorPubky) || isSandboxRisk(actorPubky)
      ? signals
      : signals.filter((signal) => signal.actorPubky === actorPubky);
  }

  getEnforcements(actorPubky: string): MarketplaceEnforcement[] {
    return isSandboxModerator(actorPubky) || isSandboxRisk(actorPubky) ? this.repository.listEnforcements() : [];
  }

  getRestrictedListingIds(): string[] {
    return this.repository.getRestrictedListingIds();
  }

  getLedger(actorPubky: string, orderId?: string): MarketplaceLedgerEntry[] {
    if (isSandboxFinance(actorPubky)) {
      return orderId ? this.repository.getLedgerForOrder(orderId) : this.repository.exportSnapshot().ledger;
    }
    return orderId
      ? this.repository
          .getLedgerForOrder(orderId)
          .filter(() => this.getOrders(actorPubky).some((order) => order.id === orderId))
      : this.repository.getLedgerForActor(actorPubky);
  }

  getPromotions(actorPubky: string): MarketplacePromotion[] {
    return this.repository.getPromotionsForSeller(actorPubky);
  }

  getBlockedBuyers(actorPubky: string): string[] {
    return this.repository.getBlockedBuyers(actorPubky);
  }

  getSellerReputation(sellerPubky: string): {
    sellerPubky: string;
    reviewCount: number;
    averageRating: number | null;
    salesCount: number;
    itemAccuracy: number | null;
    shipping: number | null;
    communication: number | null;
    responseTimeHours: number | null;
  } {
    const orders = this.repository.getOrdersForActor(sellerPubky).filter((order) => order.sellerPubky === sellerPubky);
    const reviews = orders.flatMap((order) => order.reviews.filter((review) => review.subjectPubky === sellerPubky));
    const average = (values: number[]) =>
      values.length ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10 : null;
    return {
      sellerPubky,
      reviewCount: reviews.length,
      averageRating: average(reviews.map(({ rating }) => rating)),
      salesCount: orders.filter((order) =>
        ['paid', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'].includes(order.state),
      ).length,
      itemAccuracy: average(reviews.flatMap(({ itemAccuracy }) => (itemAccuracy ? [itemAccuracy] : []))),
      shipping: average(reviews.flatMap(({ shipping }) => (shipping ? [shipping] : []))),
      communication: average(reviews.flatMap(({ communication }) => (communication ? [communication] : []))),
      responseTimeHours: this.sellerResponseTimeHours(sellerPubky),
    };
  }

  getInvariants(): {
    unbalancedOrders: string[];
    oversoldListings: string[];
    duplicateAuctionWinners: string[];
    stuckFulfillment: string[];
    reservedOnPaidOrders: string[];
  } {
    const orders = this.repository.exportSnapshot().orders;
    const unbalancedOrders = orders
      .filter((order) => {
        const entries = this.repository.getLedgerForOrder(order.id);
        const debit = entries
          .filter(({ direction }) => direction === 'debit')
          .reduce((total, entry) => total + entry.amountMinor, 0);
        const credit = entries
          .filter(({ direction }) => direction === 'credit')
          .reduce((total, entry) => total + entry.amountMinor, 0);
        return entries.length > 0 && debit !== credit;
      })
      .map((order) => order.id);
    const oversoldListings = this.repository
      .listListings()
      .filter(
        (listing) =>
          listing.availableQuantity + listing.reservedQuantity + listing.soldQuantity !== listing.totalQuantity,
      )
      .map((listing) => listing.aggregateId);
    const duplicateAuctionWinners = this.repository
      .listListings()
      .filter((listing) => listing.saleFormat === 'auction' && listing.auction?.status === 'sold')
      .filter(
        (listing) =>
          this.repository.getBidsForListing(listing.aggregateId).filter((bid) => bid.sequence === 0).length > 1,
      )
      .map((listing) => listing.aggregateId);
    const stuckFulfillment = orders
      .filter((order) => ['paid', 'processing', 'ready_for_pickup', 'shipped'].includes(order.state))
      .filter((order) => Date.parse(order.updatedAt) < Date.now() - 14 * 24 * 60 * 60 * 1_000)
      .map((order) => order.id);
    const reservedOnPaidOrders = orders
      .filter((order) => isPaidLikeOrderState(order.state) && order.inventoryState === 'reserved')
      .map((order) => order.id);
    return { unbalancedOrders, oversoldListings, duplicateAuctionWinners, stuckFulfillment, reservedOnPaidOrders };
  }

  getMetrics(): {
    listings: number;
    orders: number;
    events: number;
    paymentsConfirmed: number;
    reportsOpen: number;
    reservedOnPaidOrders: number;
  } {
    const snapshot = this.repository.exportSnapshot();
    return {
      listings: snapshot.listings.length,
      orders: snapshot.orders.length,
      events: snapshot.events.length,
      paymentsConfirmed: snapshot.payments.filter((payment) => payment.state === 'confirmed').length,
      reportsOpen: snapshot.reports.filter((report) => report.state === 'open').length,
      reservedOnPaidOrders: snapshot.orders.filter(
        (order) => isPaidLikeOrderState(order.state) && order.inventoryState === 'reserved',
      ).length,
    };
  }

  searchAdmin(
    actorPubky: string,
    query: string,
  ): {
    reports: MarketplaceReport[];
    listings: MarketplaceListingAggregate[];
    orders: Array<{ id: string; state: string }>;
    riskSignals: MarketplaceRiskSignal[];
  } {
    const role = marketplaceSandboxRoleForActor(actorPubky);
    if (!role) {
      return { reports: [], listings: [], orders: [], riskSignals: [] };
    }
    const needle = query.trim().toLowerCase();
    const matches = (value: string) => !needle || value.toLowerCase().includes(needle);
    const reports = this.repository
      .getReports()
      .filter(
        (report) => matches(report.targetId) || matches(report.reason) || matches(report.details) || matches(report.id),
      );
    const listings = this.repository
      .listListings()
      .filter((listing) => matches(listing.aggregateId) || matches(listing.title));
    const orders = this.repository
      .exportSnapshot()
      .orders.filter((order) => matches(order.id) || matches(order.buyerPubky) || matches(order.sellerPubky))
      .map((order) => ({ id: order.id, state: order.state }));
    const riskSignals = this.repository
      .getRiskSignals()
      .filter(
        (signal) =>
          matches(signal.targetId) || matches(signal.signalType) || matches(signal.details) || matches(signal.id),
      );
    if (role === 'moderator') return { reports, listings, orders, riskSignals };
    if (role === 'support') return { reports: [], listings: [], orders, riskSignals: [] };
    if (role === 'risk') return { reports: [], listings, orders: [], riskSignals };
    return { reports: [], listings: [], orders, riskSignals: [] };
  }

  exportRepositorySnapshot(): MarketplaceRepositorySnapshot {
    return this.repository.exportSnapshot();
  }

  exportAccount(actorPubky: string): {
    orders: MarketplaceOrder[];
    offers: MarketplaceOffer[];
    conversations: MarketplaceConversation[];
    notifications: MarketplaceNotification[];
    promotions: MarketplacePromotion[];
  } {
    return {
      orders: this.getOrders(actorPubky).map((order) => ({
        ...order,
        deliveryAddress: {
          ...order.deliveryAddress,
          line1: '[redacted]',
          line2: '',
          postalCode: '[redacted]',
        },
      })),
      offers: this.getOffers(actorPubky),
      conversations: this.getParticipantConversations(actorPubky).map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) => ({ ...message, attachments: [] })),
      })),
      notifications: this.getNotifications(actorPubky),
      promotions: this.getPromotions(actorPubky),
    };
  }

  private sellerResponseTimeHours(sellerPubky: string): number | null {
    const hours: number[] = [];
    for (const conversation of this.repository.getConversationsForActor(sellerPubky)) {
      if (conversation.sellerPubky !== sellerPubky) continue;
      for (const [index, message] of conversation.messages.entries()) {
        if (message.senderPubky === sellerPubky) continue;
        const reply = conversation.messages.slice(index + 1).find((candidate) => candidate.senderPubky === sellerPubky);
        if (!reply) continue;
        hours.push((Date.parse(reply.createdAt) - Date.parse(message.createdAt)) / 3_600_000);
        break;
      }
    }
    if (!hours.length) return null;
    return Math.round((hours.reduce((total, value) => total + value, 0) / hours.length) * 10) / 10;
  }

  getSellerStatement(actorPubky: string): {
    sellerPubky: string;
    orders: number;
    paidMinor: number;
    refundedMinor: number;
    heldMinor: number;
    releasedMinor: number;
    entries: MarketplaceLedgerEntry[];
  } {
    const orders = this.getOrders(actorPubky).filter((order) => order.sellerPubky === actorPubky);
    const entries = this.repository.getLedgerForActor(actorPubky);
    return {
      sellerPubky: actorPubky,
      orders: orders.length,
      paidMinor: orders
        .filter((order) => ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(order.state))
        .reduce((total, order) => total + order.total.amountMinor, 0),
      refundedMinor: orders.reduce((total, order) => total + (order.externalRefund?.amountMinor ?? 0), 0),
      heldMinor: orders
        .filter((order) => order.payoutState === 'held')
        .reduce((total, order) => total + order.total.amountMinor - order.tax.amountMinor, 0),
      releasedMinor: orders
        .filter((order) => order.payoutState === 'released')
        .reduce((total, order) => total + order.total.amountMinor - order.tax.amountMinor, 0),
      entries,
    };
  }

  getSellerAnalytics(actorPubky: string): {
    sellerPubky: string;
    views: number;
    favorites: number;
    soldQuantity: number;
    totalQuantity: number;
    sellThroughPercent: number;
    conversionPercent: number;
    paidOrders: number;
    toShip: number;
    returnsOpen: number;
    disputesOpen: number;
  } {
    const listings = this.repository.listListings().filter((listing) => listing.sellerPubky === actorPubky);
    const orders = this.getOrders(actorPubky).filter((order) => order.sellerPubky === actorPubky);
    const views = listings.reduce((total, listing) => total + this.repository.getViewCount(listing.aggregateId), 0);
    const favorites = listings.reduce(
      (total, listing) => total + this.repository.getWatcherCount(listing.aggregateId),
      0,
    );
    const soldQuantity = listings.reduce((total, listing) => total + listing.soldQuantity, 0);
    const totalQuantity = listings.reduce((total, listing) => total + listing.totalQuantity, 0);
    const paidOrders = orders.filter((order) =>
      ['paid', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'].includes(order.state),
    ).length;
    const ratio = (numerator: number, denominator: number) =>
      denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
    return {
      sellerPubky: actorPubky,
      views,
      favorites,
      soldQuantity,
      totalQuantity,
      sellThroughPercent: ratio(soldQuantity, totalQuantity),
      conversionPercent: Math.min(100, ratio(paidOrders, views)),
      paidOrders,
      toShip: orders.filter((order) => ['paid', 'processing'].includes(order.state)).length,
      returnsOpen: orders.filter((order) =>
        ['return_requested', 'return_in_transit', 'return_inspection'].includes(order.state),
      ).length,
      disputesOpen: orders.filter((order) => order.state === 'disputed').length,
    };
  }

  async execute(actorInput: unknown, commandInput: unknown): Promise<MarketplaceCommandResult> {
    const actorResult = commercePubkySchema.safeParse(actorInput);
    const commandResult = marketplaceCommandSchema.safeParse(commandInput);
    if (!actorResult.success || !commandResult.success) {
      const issues = [
        ...(actorResult.success
          ? []
          : actorResult.error.issues.map(({ message, path }) => ({ path: `actor.${path.join('.')}`, message }))),
        ...(commandResult.success
          ? []
          : commandResult.error.issues.map(({ message, path }) => ({ path: path.join('.'), message }))),
      ];
      return failure('INVALID_COMMAND', 'The marketplace command is invalid.', { issues });
    }

    const actorPubky = actorResult.data;
    const command = commandResult.data;
    const requestHash = hashCommand(command);

    return await this.repository.transaction(() => {
      const stored = this.repository.getStoredCommand(actorPubky, command.commandId);
      if (stored) {
        return stored.requestHash === requestHash
          ? stored.result
          : failure('IDEMPOTENCY_CONFLICT', 'The command id was already used with different input.');
      }

      const result = this.dispatchCommand(actorPubky, command);

      if (result.ok) {
        this.repository.putStoredCommand(actorPubky, command.commandId, { requestHash, result });
      }
      return result;
    });
  }

  private dispatchCommand(actorPubky: string, command: MarketplaceCommand): MarketplaceCommandResult {
    switch (command.kind) {
      case 'listing.register':
        return this.registerListing(actorPubky, command);
      case 'listing.watch':
        return this.watchListing(actorPubky, command, true);
      case 'listing.unwatch':
        return this.watchListing(actorPubky, command, false);
      case 'listing.view':
        return this.viewListing(actorPubky, command);
      case 'inventory.reconcile_paid':
        return this.reconcilePaidInventory(actorPubky, command);
      case 'inventory.reserve':
        return this.reserveInventory(actorPubky, command);
      case 'offer.create':
        return this.createOffer(actorPubky, command);
      case 'offer.create_private':
        return this.createPrivateOffer(actorPubky, command);
      case 'offer.counter':
        return this.counterOffer(actorPubky, command);
      case 'offer.accept':
        return this.acceptOffer(actorPubky, command);
      case 'offer.reject':
        return this.rejectOffer(actorPubky, command);
      case 'offer.withdraw':
        return this.withdrawOffer(actorPubky, command);
      case 'auction.place_bid':
        return this.placeBid(actorPubky, command);
      case 'message.send':
        return this.sendMessage(actorPubky, command);
      case 'message.block':
        return this.blockConversation(actorPubky, command);
      case 'auction.close':
        return this.closeAuction(actorPubky, command);
      case 'auction.buy_now':
        return this.buyNowAuction(actorPubky, command);
      case 'notification.mark_read':
        return this.markNotificationRead(actorPubky, command);
      case 'notification.preferences.update':
        return this.updateNotificationPreferences(actorPubky, command);
      case 'checkout.create':
        return this.createCheckout(actorPubky, command);
      case 'payment.sandbox_advance':
        return this.advanceSandboxPayment(actorPubky, command);
      case 'order.cancel_request':
        return this.requestCancellation(actorPubky, command);
      case 'order.cancel_approve':
        return this.approveCancellation(actorPubky, command);
      case 'fulfillment.ship':
        return this.shipOrder(actorPubky, command);
      case 'fulfillment.ready_for_pickup':
        return this.readyForPickup(actorPubky, command);
      case 'fulfillment.confirm_delivery':
        return this.confirmDelivery(actorPubky, command);
      case 'return.request':
        return this.requestReturn(actorPubky, command);
      case 'return.approve':
        return this.approveReturn(actorPubky, command);
      case 'return.offer_partial':
        return this.offerPartialReturn(actorPubky, command);
      case 'return.receive':
        return this.receiveReturn(actorPubky, command);
      case 'return.ship':
        return this.shipReturn(actorPubky, command);
      case 'return.inspect':
        return this.inspectReturn(actorPubky, command);
      case 'fulfillment.issue_credential':
        return this.issueDigitalCredential(actorPubky, command);
      case 'fulfillment.refresh_credential':
        return this.refreshDigitalCredential(actorPubky, command);
      case 'fulfillment.record_access':
        return this.recordDigitalAccess(actorPubky, command);
      case 'refund.record_external':
        return this.recordExternalRefund(actorPubky, command);
      case 'dispute.open':
        return this.openDispute(actorPubky, command);
      case 'dispute.resolve':
        return this.resolveDispute(actorPubky, command);
      case 'review.create':
        return this.createReview(actorPubky, command);
      case 'review.edit':
        return this.editReview(actorPubky, command);
      case 'review.reply':
        return this.replyReview(actorPubky, command);
      case 'promotion.create':
        return this.createPromotion(actorPubky, command);
      case 'payout.release':
        return this.releasePayout(actorPubky, command);
      case 'buyer.block':
        return this.blockBuyer(actorPubky, command);
      case 'buyer.unblock':
        return this.unblockBuyer(actorPubky, command);
      case 'trust.report':
        return this.createReport(actorPubky, command);
      case 'trust.decide':
        return this.decideReport(actorPubky, command);
      case 'trust.assign':
        return this.assignReport(actorPubky, command);
      case 'trust.reverse':
        return this.reverseReport(actorPubky, command);
      case 'trust.flag_risk':
        return this.flagRisk(actorPubky, command);
      case 'support.note':
        return this.addSupportNote(actorPubky, command);
      case 'risk.hold':
        return this.holdRisk(actorPubky, command);
      case 'risk.release':
        return this.releaseRisk(actorPubky, command);
    }
  }

  private registerListing(actorPubky: string, command: RegisterListingCommand): MarketplaceCommandResult {
    const { payload } = command;
    if (actorPubky !== payload.sellerPubky) {
      return failure('UNAUTHORIZED', 'Only the listing seller may register inventory.');
    }
    if (this.hasEnforcement(actorPubky, ['suspension', 'ban'])) {
      return failure('UNAUTHORIZED', 'This seller is suspended from listing.');
    }

    const expectedAggregateId = buildMarketplaceListingAggregateId(payload.sellerPubky, payload.listingId);
    if (command.aggregateId !== expectedAggregateId) {
      return failure('INVALID_COMMAND', 'The listing aggregate id does not match its seller and listing.');
    }

    const current = this.repository.getListing(command.aggregateId);
    const currentRevision = current?.serverRevision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      return failure('REVISION_CONFLICT', 'The listing revision is stale.', { currentRevision });
    }
    if (current && payload.listingRevision <= current.listingRevision) {
      return failure('REVISION_CONFLICT', 'The public listing revision must advance.', { currentRevision });
    }

    const committedQuantity = (current?.reservedQuantity ?? 0) + (current?.soldQuantity ?? 0);
    if (payload.quantity < committedQuantity) {
      return failure('INVARIANT_VIOLATION', 'Listing quantity cannot fall below committed inventory.', {
        currentRevision,
      });
    }

    const occurredAt = this.now().toISOString();
    const listing: MarketplaceListingAggregate = {
      aggregateId: command.aggregateId,
      sellerPubky: payload.sellerPubky,
      listingId: payload.listingId,
      title: payload.title,
      listingRevision: payload.listingRevision,
      contentHash: payload.contentHash,
      serverRevision: currentRevision + 1,
      state: payload.quantity === committedQuantity ? (committedQuantity > 0 ? 'reserved' : 'sold') : 'available',
      totalQuantity: payload.quantity,
      availableQuantity: payload.quantity - committedQuantity,
      reservedQuantity: current?.reservedQuantity ?? 0,
      soldQuantity: current?.soldQuantity ?? 0,
      restricted: current?.restricted ?? false,
      unitPrice: payload.unitPrice,
      saleFormat: payload.saleFormat,
      offersOpenTo: payload.offersOpenTo ?? (payload.saleFormat === 'offer' ? 'watchers' : 'anyone'),
      autoAcceptAmount: payload.autoAcceptAmount ?? null,
      fulfillment: payload.fulfillment,
      shippingQuoteMinor: payload.shippingQuoteMinor ?? null,
      digitalLock: payload.digitalLock ?? null,
      auction: payload.auctionTerms
        ? {
            ...payload.auctionTerms,
            status:
              current?.auction?.status ??
              (Date.parse(payload.auctionTerms.startsAt) > Date.parse(occurredAt) ? 'scheduled' : 'active'),
            currentPrice: current?.auction?.currentPrice ?? payload.unitPrice,
            leaderPubky: current?.auction?.leaderPubky ?? null,
            bidCount: current?.auction?.bidCount ?? 0,
            reserveMet:
              current?.auction?.reserveMet ??
              (payload.auctionTerms.reservePrice
                ? payload.unitPrice.amountMinor >= payload.auctionTerms.reservePrice.amountMinor
                : true),
          }
        : null,
      updatedAt: occurredAt,
    };
    const event = this.createEvent(actorPubky, command, listing.serverRevision, 'listing.registered', occurredAt);
    this.repository.putListing(listing);
    this.repository.appendEvent(event);
    return success(command, listing.serverRevision, event.id, { kind: 'listing', listing });
  }

  private watchListing(
    actorPubky: string,
    command: WatchListingCommand | UnwatchListingCommand,
    watching: boolean,
  ): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The listing is not registered.');
    if (listing.sellerPubky === actorPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot watch their own listing.');
    }
    if (command.expectedRevision !== 0) {
      return failure('INVALID_COMMAND', 'Watch commands use expected revision 0.');
    }

    const occurredAt = this.now().toISOString();
    this.repository.setWatching(listing.aggregateId, actorPubky, watching);
    const event = this.createEvent(
      actorPubky,
      command,
      1,
      watching ? 'listing.watched' : 'listing.unwatched',
      occurredAt,
    );
    this.repository.appendEvent(event);
    return success(command, 1, event.id, {
      kind: 'watch',
      listingAggregateId: listing.aggregateId,
      watcherPubky: actorPubky,
      watching,
    });
  }

  private viewListing(actorPubky: string, command: ViewListingCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The listing is not registered.');
    if (command.expectedRevision !== 0) {
      return failure('INVALID_COMMAND', 'View commands use expected revision 0.');
    }
    const viewCount = this.repository.getViewCount(listing.aggregateId);
    if (listing.sellerPubky === actorPubky) {
      return success(command, 1, [], {
        kind: 'view',
        listingAggregateId: listing.aggregateId,
        viewCount,
        counted: false,
      });
    }

    const occurredAt = this.now().toISOString();
    this.repository.recordView(listing.aggregateId, actorPubky);
    const event = this.createEvent(actorPubky, command, 1, 'listing.viewed', occurredAt);
    this.repository.appendEvent(event);
    return success(command, 1, event.id, {
      kind: 'view',
      listingAggregateId: listing.aggregateId,
      viewCount: viewCount + 1,
      counted: true,
    });
  }

  private reconcilePaidInventory(actorPubky: string, command: ReconcilePaidInventoryCommand): MarketplaceCommandResult {
    if (!isSandboxFinance(actorPubky)) {
      return failure('UNAUTHORIZED', 'Only sandbox finance may reconcile paid inventory.');
    }
    if (command.expectedRevision !== 0) {
      return failure('INVALID_COMMAND', 'Paid inventory reconcile uses expected revision 0.');
    }

    const occurredAt = this.now().toISOString();
    const convertedOrderIds: string[] = [];
    const skippedOrderIds: string[] = [];
    const failedOrderIds: string[] = [];
    const eventIds: string[] = [];

    for (const order of this.repository.exportSnapshot().orders) {
      if (!isPaidLikeOrderState(order.state) || order.inventoryState === 'released') {
        skippedOrderIds.push(order.id);
        continue;
      }
      if (!this.convertReservedInventoryToSold(order, occurredAt)) {
        if (order.inventoryState === 'sold') {
          skippedOrderIds.push(order.id);
          continue;
        }
        failedOrderIds.push(order.id);
        continue;
      }
      const updated: MarketplaceOrder = {
        ...order,
        revision: order.revision + 1,
        inventoryState: 'sold',
        updatedAt: occurredAt,
      };
      this.repository.putOrder(updated);
      const event = this.createEvent(
        actorPubky,
        command,
        updated.revision,
        'inventory.reconciled',
        occurredAt,
        buildMarketplaceOrderAggregateId(order.id),
      );
      this.repository.appendEvent(event);
      eventIds.push(event.id);
      convertedOrderIds.push(order.id);
    }

    const commandEvent = this.createEvent(actorPubky, command, 1, 'inventory.reconciled', occurredAt);
    this.repository.appendEvent(commandEvent);
    return success(command, 1, [...eventIds, commandEvent.id], {
      kind: 'inventory_reconcile',
      convertedOrderIds,
      skippedOrderIds,
      failedOrderIds,
    });
  }

  private reserveInventory(actorPubky: string, command: ReserveInventoryCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The listing is not registered.');
    if (listing.sellerPubky === actorPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot reserve their own listing.');
    }
    if (command.expectedRevision !== listing.serverRevision) {
      return failure('REVISION_CONFLICT', 'The listing revision is stale.', {
        currentRevision: listing.serverRevision,
      });
    }
    if (listing.availableQuantity < command.payload.quantity) {
      return failure('INSUFFICIENT_INVENTORY', 'The requested quantity is unavailable.', {
        currentRevision: listing.serverRevision,
      });
    }

    const now = this.now();
    const occurredAt = now.toISOString();
    const reservation: MarketplaceReservation = {
      id: command.commandId,
      aggregateId: command.aggregateId,
      buyerPubky: actorPubky,
      quantity: command.payload.quantity,
      status: 'active',
      expiresAt: new Date(now.getTime() + command.payload.reservationTtlSeconds * 1_000).toISOString(),
      createdAt: occurredAt,
    };
    const updatedListing: MarketplaceListingAggregate = {
      ...listing,
      serverRevision: listing.serverRevision + 1,
      state: listing.availableQuantity === command.payload.quantity ? 'reserved' : 'available',
      availableQuantity: listing.availableQuantity - command.payload.quantity,
      reservedQuantity: listing.reservedQuantity + command.payload.quantity,
      updatedAt: occurredAt,
    };
    const event = this.createEvent(
      actorPubky,
      command,
      updatedListing.serverRevision,
      'inventory.reserved',
      occurredAt,
    );
    this.repository.putListing(updatedListing);
    this.repository.putReservation(reservation);
    this.repository.appendEvent(event);
    return success(command, updatedListing.serverRevision, event.id, {
      kind: 'reservation',
      listing: updatedListing,
      reservation,
    });
  }

  private createOffer(actorPubky: string, command: CreateOfferCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The listing is not registered.');
    if (listing.sellerPubky === actorPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot make an offer on their own listing.');
    }
    if (command.expectedRevision !== listing.serverRevision) {
      return failure('REVISION_CONFLICT', 'The listing revision is stale.', {
        currentRevision: listing.serverRevision,
      });
    }
    if (listing.availableQuantity < command.payload.quantity) {
      return failure('INSUFFICIENT_INVENTORY', 'The requested offer quantity is unavailable.', {
        currentRevision: listing.serverRevision,
      });
    }
    if (!sameAsset(listing.unitPrice, command.payload.amount)) {
      return failure('INVALID_COMMAND', 'Offer amount must use the listing asset and exponent.');
    }
    if (listing.restricted) {
      return failure('INVALID_STATE', 'This listing is restricted.');
    }
    if (listing.offersOpenTo === 'watchers' && !this.repository.isWatching(listing.aggregateId, actorPubky)) {
      return failure('UNAUTHORIZED', 'Only watchers can make an offer on this listing.');
    }

    const now = this.now();
    const occurredAt = now.toISOString();
    const offer: MarketplaceOffer = {
      id: command.commandId,
      aggregateId: buildMarketplaceOfferAggregateId(command.commandId),
      listingAggregateId: listing.aggregateId,
      buyerPubky: actorPubky,
      sellerPubky: listing.sellerPubky,
      revision: 1,
      state: 'pending',
      offeredBy: actorPubky,
      amount: command.payload.amount,
      quantity: command.payload.quantity,
      message: command.payload.message,
      expiresAt: new Date(now.getTime() + command.payload.expiresInSeconds * 1_000).toISOString(),
      createdAt: occurredAt,
      updatedAt: occurredAt,
      history: [
        {
          revision: 1,
          actorPubky,
          action: 'created',
          amount: command.payload.amount,
          quantity: command.payload.quantity,
          message: command.payload.message,
          occurredAt,
        },
      ],
    };
    const event = this.createEvent(actorPubky, command, offer.revision, 'offer.created', occurredAt);
    this.repository.putOffer(offer);
    this.repository.appendEvent(event);
    this.notify(offer.sellerPubky, actorPubky, 'offer_received', offer.aggregateId, occurredAt);
    this.recordConversationSystemEvent(
      listing,
      actorPubky,
      actorPubky,
      listing.sellerPubky,
      `Offer created for ${formatSandboxMoney(offer.amount)}.`,
      offerCard(listing, offer),
      occurredAt,
    );
    if (this.shouldAutoAcceptOffer(listing, offer)) {
      return this.settleAcceptedOffer(listing.sellerPubky, command, listing, offer, occurredAt, {
        autoAccepted: true,
        extraEventIds: [event.id],
      });
    }
    return success(command, offer.revision, event.id, { kind: 'offer', offer });
  }

  private createPrivateOffer(actorPubky: string, command: CreatePrivateOfferCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The listing is not registered.');
    if (listing.sellerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the seller may send a private offer.');
    }
    if (command.payload.recipientPubky === actorPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot send a private offer to themselves.');
    }
    if (command.expectedRevision !== listing.serverRevision) {
      return failure('REVISION_CONFLICT', 'The listing revision is stale.', {
        currentRevision: listing.serverRevision,
      });
    }
    if (listing.availableQuantity < command.payload.quantity) {
      return failure('INSUFFICIENT_INVENTORY', 'The requested offer quantity is unavailable.', {
        currentRevision: listing.serverRevision,
      });
    }
    if (!sameAsset(listing.unitPrice, command.payload.amount)) {
      return failure('INVALID_COMMAND', 'Offer amount must use the listing asset and exponent.');
    }

    const now = this.now();
    const occurredAt = now.toISOString();
    const offer: MarketplaceOffer = {
      id: command.commandId,
      aggregateId: buildMarketplaceOfferAggregateId(command.commandId),
      listingAggregateId: listing.aggregateId,
      buyerPubky: command.payload.recipientPubky,
      sellerPubky: listing.sellerPubky,
      revision: 1,
      state: 'pending',
      offeredBy: actorPubky,
      amount: command.payload.amount,
      quantity: command.payload.quantity,
      message: command.payload.message,
      expiresAt: new Date(now.getTime() + command.payload.expiresInSeconds * 1_000).toISOString(),
      createdAt: occurredAt,
      updatedAt: occurredAt,
      history: [
        {
          revision: 1,
          actorPubky,
          action: 'created',
          amount: command.payload.amount,
          quantity: command.payload.quantity,
          message: command.payload.message,
          occurredAt,
        },
      ],
    };
    const event = this.createEvent(actorPubky, command, offer.revision, 'offer.created_private', occurredAt);
    this.repository.putOffer(offer);
    this.repository.appendEvent(event);
    this.notify(offer.buyerPubky, actorPubky, 'offer_received', offer.aggregateId, occurredAt);
    this.recordConversationSystemEvent(
      listing,
      offer.buyerPubky,
      actorPubky,
      offer.buyerPubky,
      `Private offer created for ${formatSandboxMoney(offer.amount)}.`,
      offerCard(listing, offer),
      occurredAt,
    );
    return success(command, offer.revision, event.id, { kind: 'offer', offer });
  }

  private counterOffer(actorPubky: string, command: CounterOfferCommand): MarketplaceCommandResult {
    const offer = this.getActionableOffer(actorPubky, command.payload.offerId, command.aggregateId);
    if (!offer.ok) return offer.failure;
    if (command.expectedRevision !== offer.value.revision) {
      return failure('REVISION_CONFLICT', 'The offer revision is stale.', {
        currentRevision: offer.value.revision,
      });
    }
    if (actorPubky === offer.value.offeredBy) {
      return failure('UNAUTHORIZED', 'The current offer author cannot counter their own terms.');
    }
    if (!sameAsset(offer.value.amount, command.payload.amount)) {
      return failure('INVALID_COMMAND', 'Counteroffer amount must use the original asset and exponent.');
    }
    const listing = this.repository.getListing(offer.value.listingAggregateId);
    if (!listing) return failure('NOT_FOUND', 'The offer listing is unavailable.');
    if (listing.availableQuantity < command.payload.quantity) {
      return failure('INSUFFICIENT_INVENTORY', 'The counteroffer quantity is unavailable.', {
        currentRevision: offer.value.revision,
      });
    }

    const now = this.now();
    const occurredAt = now.toISOString();
    const updated: MarketplaceOffer = {
      ...offer.value,
      revision: offer.value.revision + 1,
      state: 'countered',
      offeredBy: actorPubky,
      amount: command.payload.amount,
      quantity: command.payload.quantity,
      message: command.payload.message,
      expiresAt: new Date(now.getTime() + command.payload.expiresInSeconds * 1_000).toISOString(),
      updatedAt: occurredAt,
      history: [
        ...offer.value.history,
        {
          revision: offer.value.revision + 1,
          actorPubky,
          action: 'countered',
          amount: command.payload.amount,
          quantity: command.payload.quantity,
          message: command.payload.message,
          occurredAt,
        },
      ],
    };
    const event = this.createEvent(actorPubky, command, updated.revision, 'offer.countered', occurredAt);
    this.repository.putOffer(updated);
    this.repository.appendEvent(event);
    this.notify(
      actorPubky === updated.sellerPubky ? updated.buyerPubky : updated.sellerPubky,
      actorPubky,
      'offer_countered',
      updated.aggregateId,
      occurredAt,
    );
    this.recordConversationSystemEvent(
      listing,
      updated.buyerPubky,
      actorPubky,
      actorPubky === updated.sellerPubky ? updated.buyerPubky : updated.sellerPubky,
      `Offer countered to ${formatSandboxMoney(updated.amount)}.`,
      offerCard(listing, updated),
      occurredAt,
    );
    return success(command, updated.revision, event.id, { kind: 'offer', offer: updated });
  }

  private acceptOffer(actorPubky: string, command: AcceptOfferCommand): MarketplaceCommandResult {
    const offer = this.getActionableOffer(actorPubky, command.payload.offerId, command.aggregateId);
    if (!offer.ok) return offer.failure;
    if (command.expectedRevision !== offer.value.revision) {
      return failure('REVISION_CONFLICT', 'The offer revision is stale.', {
        currentRevision: offer.value.revision,
      });
    }
    if (actorPubky === offer.value.offeredBy) {
      return failure('UNAUTHORIZED', 'The current offer author cannot accept their own terms.');
    }
    const listing = this.repository.getListing(offer.value.listingAggregateId);
    if (!listing) return failure('NOT_FOUND', 'The offer listing is unavailable.');
    if (listing.availableQuantity < offer.value.quantity) {
      return failure('INSUFFICIENT_INVENTORY', 'The offered quantity is no longer available.', {
        currentRevision: offer.value.revision,
      });
    }

    return this.settleAcceptedOffer(actorPubky, command, listing, offer.value, this.now().toISOString(), {
      autoAccepted: false,
    });
  }

  private shouldAutoAcceptOffer(listing: MarketplaceListingAggregate, offer: MarketplaceOffer): boolean {
    const threshold = listing.autoAcceptAmount;
    return (
      threshold != null &&
      sameAsset(threshold, offer.amount) &&
      offer.amount.amountMinor >= threshold.amountMinor &&
      listing.availableQuantity >= offer.quantity
    );
  }

  private settleAcceptedOffer(
    actorPubky: string,
    command: MarketplaceCommand,
    listing: MarketplaceListingAggregate,
    offer: MarketplaceOffer,
    occurredAt: string,
    options: { autoAccepted: boolean; extraEventIds?: string[] },
  ): MarketplaceCommandResult {
    const extraEventIds = options.extraEventIds ?? [];
    const acceptedOffer = this.finishOffer(offer, actorPubky, 'accepted', occurredAt);
    const reservation: MarketplaceReservation = {
      id: command.commandId,
      aggregateId: listing.aggregateId,
      buyerPubky: acceptedOffer.buyerPubky,
      quantity: acceptedOffer.quantity,
      status: 'active',
      expiresAt: new Date(Date.parse(occurredAt) + 30 * 60 * 1_000).toISOString(),
      createdAt: occurredAt,
    };
    const updatedListing: MarketplaceListingAggregate = {
      ...listing,
      serverRevision: listing.serverRevision + 1,
      state: listing.availableQuantity === acceptedOffer.quantity ? 'reserved' : 'available',
      availableQuantity: listing.availableQuantity - acceptedOffer.quantity,
      reservedQuantity: listing.reservedQuantity + acceptedOffer.quantity,
      updatedAt: occurredAt,
    };
    const offerEvent = this.createEvent(actorPubky, command, acceptedOffer.revision, 'offer.accepted', occurredAt);
    const inventoryEvent = this.createEvent(
      actorPubky,
      command,
      updatedListing.serverRevision,
      'inventory.reserved',
      occurredAt,
      updatedListing.aggregateId,
    );
    this.repository.putOffer(acceptedOffer);
    this.repository.putListing(updatedListing);
    this.repository.putReservation(reservation);
    this.repository.appendEvent(offerEvent);
    this.repository.appendEvent(inventoryEvent);
    this.notify(
      actorPubky === acceptedOffer.sellerPubky ? acceptedOffer.buyerPubky : acceptedOffer.sellerPubky,
      actorPubky,
      'offer_accepted',
      acceptedOffer.aggregateId,
      occurredAt,
    );
    this.recordConversationSystemEvent(
      listing,
      acceptedOffer.buyerPubky,
      actorPubky,
      actorPubky === acceptedOffer.sellerPubky ? acceptedOffer.buyerPubky : acceptedOffer.sellerPubky,
      options.autoAccepted
        ? `Offer auto-accepted at ${formatSandboxMoney(acceptedOffer.amount)}.`
        : `Offer accepted at ${formatSandboxMoney(acceptedOffer.amount)}.`,
      offerCard(listing, acceptedOffer),
      occurredAt,
    );
    return success(command, acceptedOffer.revision, [...extraEventIds, offerEvent.id, inventoryEvent.id], {
      kind: 'accepted_offer',
      offer: acceptedOffer,
      listing: updatedListing,
      reservation,
    });
  }

  private rejectOffer(actorPubky: string, command: RejectOfferCommand): MarketplaceCommandResult {
    return this.completeOfferAction(actorPubky, command, 'rejected', 'offer.rejected');
  }

  private withdrawOffer(actorPubky: string, command: WithdrawOfferCommand): MarketplaceCommandResult {
    const offer = this.getActionableOffer(actorPubky, command.payload.offerId, command.aggregateId);
    if (!offer.ok) return offer.failure;
    if (actorPubky !== offer.value.offeredBy) {
      return failure('UNAUTHORIZED', 'Only the current offer author may withdraw it.');
    }
    return this.completeOfferAction(actorPubky, command, 'withdrawn', 'offer.withdrawn');
  }

  private completeOfferAction(
    actorPubky: string,
    command: RejectOfferCommand | WithdrawOfferCommand,
    state: 'rejected' | 'withdrawn',
    eventKind: 'offer.rejected' | 'offer.withdrawn',
  ): MarketplaceCommandResult {
    const offer = this.getActionableOffer(actorPubky, command.payload.offerId, command.aggregateId);
    if (!offer.ok) return offer.failure;
    if (command.expectedRevision !== offer.value.revision) {
      return failure('REVISION_CONFLICT', 'The offer revision is stale.', {
        currentRevision: offer.value.revision,
      });
    }
    if (state === 'rejected' && actorPubky === offer.value.offeredBy) {
      return failure('UNAUTHORIZED', 'The current offer author cannot reject their own terms.');
    }

    const occurredAt = this.now().toISOString();
    const updated = this.finishOffer(offer.value, actorPubky, state, occurredAt);
    const event = this.createEvent(actorPubky, command, updated.revision, eventKind, occurredAt);
    this.repository.putOffer(updated);
    this.repository.appendEvent(event);
    if (state === 'rejected') {
      this.notify(
        actorPubky === updated.sellerPubky ? updated.buyerPubky : updated.sellerPubky,
        actorPubky,
        'offer_rejected',
        updated.aggregateId,
        occurredAt,
      );
    }
    const listing = this.repository.getListing(updated.listingAggregateId);
    if (listing) {
      this.recordConversationSystemEvent(
        listing,
        updated.buyerPubky,
        actorPubky,
        actorPubky === updated.sellerPubky ? updated.buyerPubky : updated.sellerPubky,
        state === 'rejected'
          ? `Offer rejected at ${formatSandboxMoney(updated.amount)}.`
          : `Offer withdrawn at ${formatSandboxMoney(updated.amount)}.`,
        offerCard(listing, updated),
        occurredAt,
      );
    }
    return success(command, updated.revision, event.id, { kind: 'offer', offer: updated });
  }

  private getActionableOffer(
    actorPubky: string,
    offerId: string,
    aggregateId: string,
  ): { ok: true; value: MarketplaceOffer } | { ok: false; failure: MarketplaceCommandFailure } {
    const offer = this.repository.getOffer(offerId);
    if (!offer) return { ok: false, failure: failure('NOT_FOUND', 'The offer was not found.') };
    if (aggregateId !== offer.aggregateId) {
      return { ok: false, failure: failure('INVALID_COMMAND', 'The offer aggregate id is invalid.') };
    }
    if (actorPubky !== offer.buyerPubky && actorPubky !== offer.sellerPubky) {
      return { ok: false, failure: failure('UNAUTHORIZED', 'Only offer participants may act on it.') };
    }
    if (offer.state !== 'pending' && offer.state !== 'countered') {
      return { ok: false, failure: failure('INVALID_STATE', 'The offer is no longer actionable.') };
    }
    if (Date.parse(offer.expiresAt) <= this.now().getTime()) {
      return { ok: false, failure: failure('OFFER_EXPIRED', 'The offer has expired.') };
    }
    return { ok: true, value: offer };
  }

  private finishOffer(
    offer: MarketplaceOffer,
    actorPubky: string,
    state: 'accepted' | 'rejected' | 'withdrawn',
    occurredAt: string,
  ): MarketplaceOffer {
    const revision = offer.revision + 1;
    return {
      ...offer,
      revision,
      state,
      updatedAt: occurredAt,
      history: [
        ...offer.history,
        {
          revision,
          actorPubky,
          action: state,
          amount: offer.amount,
          quantity: offer.quantity,
          message: '',
          occurredAt,
        },
      ],
    };
  }

  private placeBid(actorPubky: string, command: PlaceBidCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The auction listing is not registered.');
    if (listing.sellerPubky === actorPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot bid on their own auction.');
    }
    if (listing.saleFormat !== 'auction' || !listing.auction) {
      return failure('INVALID_STATE', 'This listing is not an auction.');
    }
    if (listing.auction.status !== 'active') {
      return failure('AUCTION_CLOSED', 'The auction is not open for bidding.');
    }
    if (command.expectedRevision !== listing.serverRevision) {
      return failure('REVISION_CONFLICT', 'The auction revision is stale.', {
        currentRevision: listing.serverRevision,
      });
    }
    const now = this.now();
    const nowMs = now.getTime();
    if (nowMs < Date.parse(listing.auction.startsAt) || nowMs >= Date.parse(listing.auction.endsAt)) {
      return failure('AUCTION_CLOSED', 'The auction is not open for bidding.');
    }
    if (!sameAsset(listing.unitPrice, command.payload.maximumAmount)) {
      return failure('INVALID_COMMAND', 'Bid maximum must use the auction asset and exponent.');
    }
    if (command.payload.maximumAmount.amountMinor <= listing.auction.currentPrice.amountMinor) {
      return failure('BID_TOO_LOW', 'Bid maximum must exceed the current visible price.', {
        currentRevision: listing.serverRevision,
      });
    }

    const previousBids = this.repository.getBidsForListing(listing.aggregateId);
    const bidderPreviousMaximum = previousBids
      .filter((bid) => bid.bidderPubky === actorPubky)
      .reduce((maximum, bid) => Math.max(maximum, bid.maximumAmount.amountMinor), 0);
    if (command.payload.maximumAmount.amountMinor <= bidderPreviousMaximum) {
      return failure('BID_TOO_LOW', 'A new proxy maximum must exceed the bidder previous maximum.', {
        currentRevision: listing.serverRevision,
      });
    }

    const occurredAt = now.toISOString();
    const bid: MarketplaceBid = {
      id: command.commandId,
      listingAggregateId: listing.aggregateId,
      bidderPubky: actorPubky,
      maximumAmount: command.payload.maximumAmount,
      sequence: listing.auction.bidCount + 1,
      createdAt: occurredAt,
    };
    const bidderMaximums = latestBidderMaximums([...previousBids, bid]);
    const ranked = [...bidderMaximums.values()].sort(
      (left, right) =>
        right.maximumAmount.amountMinor - left.maximumAmount.amountMinor || left.sequence - right.sequence,
    );
    const leader = ranked[0];
    const runnerUp = ranked[1];
    const visibleAmount = runnerUp
      ? Math.min(
          leader.maximumAmount.amountMinor,
          runnerUp.maximumAmount.amountMinor + listing.auction.minimumIncrement.amountMinor,
        )
      : listing.unitPrice.amountMinor;
    const remainingMs = Date.parse(listing.auction.endsAt) - nowMs;
    const shouldExtend =
      listing.auction.antiSnipingWindowSeconds > 0 && remainingMs <= listing.auction.antiSnipingWindowSeconds * 1_000;
    const endsAt = shouldExtend
      ? new Date(nowMs + listing.auction.antiSnipingExtensionSeconds * 1_000).toISOString()
      : listing.auction.endsAt;
    const currentPrice = { ...listing.unitPrice, amountMinor: visibleAmount };
    const updatedListing: MarketplaceListingAggregate = {
      ...listing,
      serverRevision: listing.serverRevision + 1,
      auction: {
        ...listing.auction,
        endsAt,
        currentPrice,
        leaderPubky: leader.bidderPubky,
        bidCount: listing.auction.bidCount + 1,
        reserveMet: listing.auction.reservePrice ? visibleAmount >= listing.auction.reservePrice.amountMinor : true,
      },
      updatedAt: occurredAt,
    };
    const event = this.createEvent(
      actorPubky,
      command,
      updatedListing.serverRevision,
      'auction.bid_placed',
      occurredAt,
    );
    this.repository.putBid(bid);
    this.repository.putListing(updatedListing);
    this.repository.appendEvent(event);
    this.recordAuctionManipulationSignals({
      listing: updatedListing,
      previousBids,
      bid,
      previousVisibleMinor: listing.auction.currentPrice.amountMinor,
      becameLeader: updatedListing.auction?.leaderPubky === actorPubky,
      occurredAt,
    });
    if (
      listing.auction.leaderPubky &&
      listing.auction.leaderPubky !== updatedListing.auction?.leaderPubky &&
      listing.auction.leaderPubky !== actorPubky
    ) {
      this.notify(listing.auction.leaderPubky, actorPubky, 'outbid', listing.aggregateId, occurredAt);
    }
    return success(command, updatedListing.serverRevision, event.id, {
      kind: 'bid',
      listing: updatedListing,
      bid,
    });
  }

  private closeAuction(actorPubky: string, command: CloseAuctionCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The auction listing is not registered.');
    if (listing.sellerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the seller may close this sandbox auction.');
    }
    if (!listing.auction || listing.saleFormat !== 'auction' || listing.auction.status !== 'active') {
      return failure('INVALID_STATE', 'The auction is not active.');
    }
    if (command.expectedRevision !== listing.serverRevision) {
      return failure('REVISION_CONFLICT', 'The auction revision is stale.', {
        currentRevision: listing.serverRevision,
      });
    }
    const now = this.now();
    if (now.getTime() < Date.parse(listing.auction.endsAt)) {
      return failure('AUCTION_CLOSED', 'The auction has not ended yet.');
    }

    const sold = Boolean(listing.auction.leaderPubky && listing.auction.reserveMet);
    const occurredAt = now.toISOString();
    const reservation: MarketplaceReservation | null =
      sold && listing.auction.leaderPubky
        ? {
            id: command.commandId,
            aggregateId: listing.aggregateId,
            buyerPubky: listing.auction.leaderPubky,
            quantity: 1,
            status: 'active',
            expiresAt: new Date(now.getTime() + 30 * 60 * 1_000).toISOString(),
            createdAt: occurredAt,
          }
        : null;
    const updatedListing: MarketplaceListingAggregate = {
      ...listing,
      serverRevision: listing.serverRevision + 1,
      state: sold ? 'reserved' : 'available',
      availableQuantity: sold ? listing.availableQuantity - 1 : listing.availableQuantity,
      reservedQuantity: sold ? listing.reservedQuantity + 1 : listing.reservedQuantity,
      auction: {
        ...listing.auction,
        status: sold ? 'sold' : 'unsold',
      },
      updatedAt: occurredAt,
    };
    const event = this.createEvent(
      actorPubky,
      command,
      updatedListing.serverRevision,
      sold ? 'auction.closed_sold' : 'auction.closed_unsold',
      occurredAt,
    );
    this.repository.putListing(updatedListing);
    if (reservation) this.repository.putReservation(reservation);
    this.repository.appendEvent(event);
    if (reservation) {
      this.notify(reservation.buyerPubky, actorPubky, 'auction_won', listing.aggregateId, occurredAt);
    }
    return success(command, updatedListing.serverRevision, event.id, {
      kind: 'auction_result',
      outcome: sold ? 'sold' : 'unsold',
      winnerPubky: reservation?.buyerPubky ?? null,
      listing: updatedListing,
      reservation,
    });
  }

  private buyNowAuction(actorPubky: string, command: BuyNowAuctionCommand): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.aggregateId);
    if (!listing) return failure('NOT_FOUND', 'The auction listing is not registered.');
    if (listing.sellerPubky === actorPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot buy their own auction.');
    }
    if (!listing.auction || listing.saleFormat !== 'auction' || listing.auction.status !== 'active') {
      return failure('INVALID_STATE', 'The auction is not active.');
    }
    if (!listing.auction.buyNowPrice) {
      return failure('INVALID_STATE', 'This auction does not allow buy-now.');
    }
    if (listing.restricted) return failure('INVALID_STATE', 'This listing is restricted.');
    if (command.expectedRevision !== listing.serverRevision) {
      return failure('REVISION_CONFLICT', 'The auction revision is stale.', {
        currentRevision: listing.serverRevision,
      });
    }
    const now = this.now();
    if (now.getTime() < Date.parse(listing.auction.startsAt) || now.getTime() >= Date.parse(listing.auction.endsAt)) {
      return failure('AUCTION_CLOSED', 'The auction is not open for buy-now.');
    }
    if (listing.availableQuantity < 1) {
      return failure('INSUFFICIENT_INVENTORY', 'Buy-now quantity is unavailable.', {
        currentRevision: listing.serverRevision,
      });
    }

    const occurredAt = now.toISOString();
    const reservation: MarketplaceReservation = {
      id: command.commandId,
      aggregateId: listing.aggregateId,
      buyerPubky: actorPubky,
      quantity: 1,
      status: 'active',
      expiresAt: new Date(now.getTime() + 30 * 60 * 1_000).toISOString(),
      createdAt: occurredAt,
    };
    const updatedListing: MarketplaceListingAggregate = {
      ...listing,
      serverRevision: listing.serverRevision + 1,
      state: 'reserved',
      availableQuantity: listing.availableQuantity - 1,
      reservedQuantity: listing.reservedQuantity + 1,
      auction: {
        ...listing.auction,
        status: 'sold',
        currentPrice: listing.auction.buyNowPrice,
        leaderPubky: actorPubky,
        bidCount: listing.auction.bidCount + 1,
        reserveMet: true,
      },
      updatedAt: occurredAt,
    };
    const event = this.createEvent(actorPubky, command, updatedListing.serverRevision, 'auction.buy_now', occurredAt);
    this.repository.putListing(updatedListing);
    this.repository.putReservation(reservation);
    this.repository.appendEvent(event);
    this.notify(listing.sellerPubky, actorPubky, 'auction_ended', listing.aggregateId, occurredAt);
    return success(command, updatedListing.serverRevision, event.id, {
      kind: 'auction_result',
      outcome: 'sold',
      winnerPubky: actorPubky,
      listing: updatedListing,
      reservation,
    });
  }

  private sendMessage(actorPubky: string, command: SendMarketplaceMessageCommand): MarketplaceCommandResult {
    if (this.hasEnforcement(actorPubky, ['message_limit', 'suspension', 'ban'])) {
      return failure('UNAUTHORIZED', 'Messaging is limited for this account.');
    }
    const listing = this.repository.getListing(command.payload.listingAggregateId);
    if (!listing) return failure('NOT_FOUND', 'The message listing is unavailable.');
    const actorIsSeller = actorPubky === listing.sellerPubky;
    if (!actorIsSeller && command.payload.recipientPubky !== listing.sellerPubky) {
      return failure('UNAUTHORIZED', 'A buyer may message only the listing seller.');
    }
    if (actorIsSeller && command.payload.recipientPubky === listing.sellerPubky) {
      return failure('UNAUTHORIZED', 'A seller cannot message themselves.');
    }

    const buyerPubky = actorIsSeller ? command.payload.recipientPubky : actorPubky;
    const expectedConversationId = buildMarketplaceConversationAggregateId(
      listing.sellerPubky,
      buyerPubky,
      listing.listingId,
    );
    if (command.aggregateId !== expectedConversationId) {
      return failure('INVALID_COMMAND', 'The conversation aggregate id is invalid.');
    }
    const current = this.repository.getConversation(command.aggregateId);
    const currentRevision = current?.revision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      return failure('REVISION_CONFLICT', 'The conversation revision is stale.', { currentRevision });
    }
    const attachments = command.payload.attachmentIds.map((id) => this.repository.getAttachment(id));
    if (
      attachments.some(
        (attachment) =>
          !attachment ||
          attachment.senderPubky !== actorPubky ||
          attachment.recipientPubky !== command.payload.recipientPubky ||
          attachment.messageId !== null,
      )
    ) {
      return failure('INVALID_COMMAND', 'Message attachments are invalid, reused, or owned by another participant.');
    }

    const occurredAt = this.now().toISOString();
    const kind = command.payload.kind ?? 'text';
    const resolvedCard = this.resolveMessageCard(kind, listing, command.payload.card, actorPubky);
    if (!resolvedCard.ok) return resolvedCard.failure;
    const message: MarketplaceMessage = {
      id: command.commandId,
      conversationId: command.aggregateId,
      listingAggregateId: listing.aggregateId,
      senderPubky: actorPubky,
      recipientPubky: command.payload.recipientPubky,
      kind,
      text: command.payload.text || defaultCardText(kind, resolvedCard.card),
      card: resolvedCard.card,
      attachments: attachments.map((attachment) => toAttachmentMetadata(attachment!)),
      createdAt: occurredAt,
    };
    if (current?.blockedBy.length) {
      return failure('UNAUTHORIZED', 'This conversation is blocked.');
    }
    const conversation: MarketplaceConversation = {
      id: command.aggregateId,
      listingAggregateId: listing.aggregateId,
      sellerPubky: listing.sellerPubky,
      buyerPubky,
      revision: currentRevision + 1,
      lastMessageAt: occurredAt,
      messages: [...(current?.messages ?? []), message],
      blockedBy: current?.blockedBy ?? [],
    };
    const event = this.createEvent(actorPubky, command, conversation.revision, 'message.sent', occurredAt);
    this.repository.putConversation(conversation);
    for (const attachment of attachments) {
      this.repository.putAttachment({ ...attachment!, messageId: message.id });
    }
    this.repository.appendEvent(event);
    this.notify(message.recipientPubky, actorPubky, 'message_received', conversation.id, occurredAt);
    return success(command, conversation.revision, event.id, { kind: 'message', conversation, message });
  }

  private markNotificationRead(
    actorPubky: string,
    command: MarkMarketplaceNotificationReadCommand,
  ): MarketplaceCommandResult {
    const notification = this.repository.getNotification(command.payload.notificationId);
    if (!notification) return failure('NOT_FOUND', 'The notification was not found.');
    if (notification.recipientPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the notification recipient may mark it read.');
    }
    if (command.aggregateId !== `notification:${notification.id}`) {
      return failure('INVALID_COMMAND', 'The notification aggregate id is invalid.');
    }
    if (command.expectedRevision !== notification.revision) {
      return failure('REVISION_CONFLICT', 'The notification revision is stale.', {
        currentRevision: notification.revision,
      });
    }
    if (notification.readAt) return failure('INVALID_STATE', 'The notification is already read.');

    const occurredAt = this.now().toISOString();
    const updated: MarketplaceNotification = {
      ...notification,
      revision: notification.revision + 1,
      readAt: occurredAt,
    };
    const event = this.createEvent(actorPubky, command, updated.revision, 'notification.read', occurredAt);
    this.repository.putNotification(updated);
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, { kind: 'notification', notification: updated });
  }

  private updateNotificationPreferences(
    actorPubky: string,
    command: UpdateMarketplaceNotificationPreferencesCommand,
  ): MarketplaceCommandResult {
    if (command.aggregateId !== `notification_preferences:${actorPubky}`) {
      return failure('INVALID_COMMAND', 'The notification preferences aggregate id is invalid.');
    }
    const current = this.repository.getNotificationPreferences(actorPubky);
    const currentRevision = current?.revision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      return failure('REVISION_CONFLICT', 'The notification preferences revision is stale.', { currentRevision });
    }
    const occurredAt = this.now().toISOString();
    const preferences: MarketplaceNotificationPreferences = {
      ownerPubky: actorPubky,
      revision: currentRevision + 1,
      ...command.payload,
      updatedAt: occurredAt,
    };
    const event = this.createEvent(
      actorPubky,
      command,
      preferences.revision,
      'notification.preferences_updated',
      occurredAt,
    );
    this.repository.putNotificationPreferences(preferences);
    this.repository.appendEvent(event);
    return success(command, preferences.revision, event.id, { kind: 'notification_preferences', preferences });
  }

  private createCheckout(actorPubky: string, command: CreateMarketplaceCheckoutCommand): MarketplaceCommandResult {
    if (
      command.aggregateId !== buildMarketplaceCheckoutAggregateId(command.commandId) ||
      command.expectedRevision !== 0
    ) {
      return failure('INVALID_COMMAND', 'Checkout aggregate identity or revision is invalid.');
    }
    const resolved = command.payload.lines.map((line) => ({
      requested: line,
      listing: this.repository.getListing(line.listingAggregateId),
    }));
    if (resolved.some(({ listing }) => !listing)) {
      return failure('NOT_FOUND', 'A checkout listing is unavailable.');
    }
    for (const { requested, listing } of resolved) {
      if (!listing) continue;
      if (listing.sellerPubky === actorPubky) {
        return failure('UNAUTHORIZED', 'A buyer cannot purchase their own listing.');
      }
      if (listing.restricted) {
        return failure('INVALID_STATE', 'A restricted listing cannot enter checkout.');
      }
      if (requested.expectedRevision !== listing.serverRevision) {
        return failure('REVISION_CONFLICT', 'A checkout listing revision is stale.', {
          currentRevision: listing.serverRevision,
        });
      }
      if (listing.saleFormat !== 'fixed_price' || listing.state !== 'available') {
        return failure('INVALID_STATE', 'Only available fixed-price listings can enter checkout.');
      }
      if (requested.quantity > listing.availableQuantity) {
        return failure('INSUFFICIENT_INVENTORY', 'Checkout quantity is unavailable.', {
          currentRevision: listing.serverRevision,
        });
      }
    }
    const listings = resolved.map(({ listing }) => listing!);
    const asset = listings[0].unitPrice;
    if (listings.some((listing) => !sameAsset(asset, listing.unitPrice))) {
      return failure('INVALID_COMMAND', 'One checkout may contain only one asset and exponent.');
    }

    const now = this.now();
    const occurredAt = now.toISOString();
    for (const listing of listings) {
      if (this.repository.isBuyerBlocked(listing.sellerPubky, actorPubky)) {
        return failure('UNAUTHORIZED', 'This seller has blocked the buyer.');
      }
      if (this.hasEnforcement(actorPubky, ['transaction_hold', 'suspension', 'ban'])) {
        return failure('UNAUTHORIZED', 'Buyer account is held or suspended.');
      }
      if (this.hasEnforcement(listing.sellerPubky, ['transaction_hold', 'suspension', 'ban'])) {
        return failure('UNAUTHORIZED', 'Seller account cannot accept new transactions.');
      }
    }
    const sellerGroups = new Map<
      string,
      Array<{ requested: (typeof resolved)[number]['requested']; listing: MarketplaceListingAggregate }>
    >();
    for (const item of resolved) {
      const listing = item.listing!;
      const group = sellerGroups.get(listing.sellerPubky) ?? [];
      group.push({ requested: item.requested, listing });
      sellerGroups.set(listing.sellerPubky, group);
    }

    const couponCode = command.payload.couponCode ?? null;
    if (couponCode) {
      for (const sellerPubky of sellerGroups.keys()) {
        const promotion = this.repository.getPromotion(sellerPubky, couponCode);
        if (
          !promotion ||
          Date.parse(promotion.expiresAt) <= now.getTime() ||
          promotion.usedCount >= promotion.usageLimit
        ) {
          return failure('INVALID_COMMAND', 'The coupon is invalid, expired, or exhausted.');
        }
      }
    }

    const orders: MarketplaceOrder[] = [];
    const payments: MarketplacePayment[] = [];
    const eventIds: string[] = [];
    for (const [sellerPubky, items] of sellerGroups) {
      const lines: MarketplaceOrderLine[] = items.map(({ requested, listing }) => ({
        listingAggregateId: listing.aggregateId,
        listingRevision: listing.listingRevision,
        contentHash: listing.contentHash,
        title: listing.title,
        quantity: requested.quantity,
        unitPrice: listing.unitPrice,
        subtotal: { ...listing.unitPrice, amountMinor: listing.unitPrice.amountMinor * requested.quantity },
      }));
      const subtotalMinor = lines.reduce((total, line) => total + line.subtotal.amountMinor, 0);
      const fulfillment = resolveSandboxOrderFulfillment(items.map(({ listing }) => listing.fulfillment));
      const couponCode = command.payload.couponCode ?? null;
      const promotion = couponCode ? this.repository.getPromotion(sellerPubky, couponCode) : undefined;
      if (
        couponCode &&
        (!promotion || Date.parse(promotion.expiresAt) <= now.getTime() || promotion.usedCount >= promotion.usageLimit)
      ) {
        return failure('INVALID_COMMAND', 'The coupon is invalid, expired, or exhausted.');
      }
      const discountMinor = promotion ? Math.round((subtotalMinor * promotion.percentOff) / 100) : 0;
      const listingShippingMinor =
        fulfillment === 'digital'
          ? 0
          : Math.max(
              ...items.map(({ listing }) => listing.shippingQuoteMinor ?? MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR),
            );
      const quote = quoteSandboxCheckoutTotals({
        subtotalMinor,
        discountMinor,
        fulfillment,
        shippingMinor: listingShippingMinor,
      });
      const shippingMinor = quote.shippingMinor;
      const taxMinor = quote.taxMinor;
      const totalMinor = quote.totalMinor;
      const orderId = randomUUID();
      const paymentId = randomUUID();
      const order: MarketplaceOrder = {
        id: orderId,
        buyerPubky: actorPubky,
        sellerPubky,
        revision: 1,
        state: 'pending_payment',
        lines,
        deliveryAddress: command.payload.deliveryAddress,
        subtotal: { ...asset, amountMinor: subtotalMinor },
        shipping: { ...asset, amountMinor: shippingMinor },
        tax: { ...asset, amountMinor: taxMinor },
        discount: { ...asset, amountMinor: discountMinor },
        total: { ...asset, amountMinor: totalMinor },
        couponCode,
        payoutState: 'held',
        guaranteePolicyVersion: command.payload.guaranteePolicyVersion,
        paymentId,
        receiptId: null,
        cancellationReason: null,
        shipment: null,
        returnRequest: null,
        dispute: null,
        externalRefund: null,
        reviews: [],
        fulfillment,
        digitalDelivery: null,
        inventoryState: 'reserved',
        taxAdapterVersion: quote.taxAdapterVersion,
        shippingAdapterVersion: quote.shippingAdapterVersion,
        supportNotes: [],
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      const payment: MarketplacePayment = {
        id: paymentId,
        orderId,
        buyerPubky: actorPubky,
        sellerPubky,
        revision: 1,
        adapter: 'sandbox',
        endpointId: command.payload.paymentEndpoint ?? 'sandbox_paykit_btc',
        state: 'awaiting_entitlement',
        confirmations: 0,
        locksBundleId: randomUUID(),
        amount: order.total,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      this.repository.putOrder(order);
      this.repository.putPayment(payment);
      if (promotion) {
        this.repository.putPromotion({ ...promotion, usedCount: promotion.usedCount + 1 });
      }
      const ledger = this.postOrderLedger(order, occurredAt);
      if (!ledger.ok) return ledger.failure;
      orders.push(order);
      payments.push(payment);
      const event = this.createEvent(actorPubky, command, 1, 'order.created', occurredAt, `order:${orderId}`);
      this.repository.appendEvent(event);
      eventIds.push(event.id);
      this.notify(sellerPubky, actorPubky, 'order_created', `order:${orderId}`, occurredAt);
      this.notify(actorPubky, sellerPubky, 'order_created', `order:${orderId}`, occurredAt);
    }

    for (const { requested, listing } of resolved) {
      this.repository.putListing({
        ...listing!,
        serverRevision: listing!.serverRevision + 1,
        state: listing!.availableQuantity === requested.quantity ? 'reserved' : 'available',
        availableQuantity: listing!.availableQuantity - requested.quantity,
        reservedQuantity: listing!.reservedQuantity + requested.quantity,
        updatedAt: occurredAt,
      });
    }
    return success(command, 1, eventIds, { kind: 'checkout', orders, payments });
  }

  private advanceSandboxPayment(actorPubky: string, command: AdvanceSandboxPaymentCommand): MarketplaceCommandResult {
    const payment = this.repository.getPayment(command.payload.paymentId);
    if (!payment) return failure('NOT_FOUND', 'The sandbox payment was not found.');
    if (payment.buyerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the buyer may advance a sandbox payment.');
    }
    if (command.aggregateId !== buildMarketplacePaymentAggregateId(payment.id)) {
      return failure('INVALID_COMMAND', 'The payment aggregate id is invalid.');
    }
    if (command.expectedRevision !== payment.revision) {
      return failure('REVISION_CONFLICT', 'The payment revision is stale.', { currentRevision: payment.revision });
    }
    const allowed =
      payment.state === 'awaiting_entitlement'
        ? ['detected', 'confirmed', 'expired', 'manual_review']
        : payment.state === 'detected'
          ? ['confirmed', 'manual_review']
          : [];
    if (!allowed.includes(command.payload.target)) {
      return failure('INVALID_STATE', 'The sandbox payment transition is invalid.');
    }
    if (command.payload.target === 'confirmed' && command.payload.confirmations < 1) {
      return failure('INVALID_COMMAND', 'Confirmed payment requires at least one confirmation.');
    }

    const order = this.repository.getOrder(payment.orderId);
    if (!order) return failure('INVARIANT_VIOLATION', 'Payment order is missing.');
    const occurredAt = this.now().toISOString();
    const updatedPayment: MarketplacePayment = {
      ...payment,
      revision: payment.revision + 1,
      state: command.payload.target,
      confirmations: command.payload.confirmations,
      updatedAt: occurredAt,
    };
    const eventKind = `payment.${command.payload.target}` as MarketplaceEvent['kind'];
    const paymentEvent = this.createEvent(actorPubky, command, updatedPayment.revision, eventKind, occurredAt);
    let updatedOrder = order;
    let receipt: MarketplaceReceipt | null = null;
    const eventIds = [paymentEvent.id];
    if (updatedPayment.state === 'expired' && order.state === 'pending_payment') {
      const released = this.releaseOrderInventory(order, occurredAt, 'reserved');
      if (!released) return failure('INVARIANT_VIOLATION', 'Expired payment could not release reserved inventory.');
      updatedOrder = {
        ...order,
        revision: order.revision + 1,
        state: 'cancelled',
        inventoryState: 'released',
        cancellationReason: order.cancellationReason ?? 'Sandbox payment expired',
        updatedAt: occurredAt,
      };
      const cancelEvent = this.createEvent(
        actorPubky,
        command,
        updatedOrder.revision,
        'order.cancelled',
        occurredAt,
        `order:${order.id}`,
      );
      eventIds.push(cancelEvent.id);
      this.repository.appendEvent(cancelEvent);
      this.notify(order.sellerPubky, actorPubky, 'order_cancelled', `order:${order.id}`, occurredAt);
      this.notify(order.buyerPubky, order.sellerPubky, 'order_cancelled', `order:${order.id}`, occurredAt);
    }
    if (updatedPayment.state === 'confirmed') {
      const converted = this.convertReservedInventoryToSold(order, occurredAt);
      if (!converted) {
        return failure('INVARIANT_VIOLATION', 'Confirmed payment could not convert reserved inventory to sold.');
      }
      const receiptId = randomUUID();
      updatedOrder = {
        ...order,
        revision: order.revision + 1,
        state: 'paid',
        inventoryState: 'sold',
        receiptId,
        updatedAt: occurredAt,
      };
      const receiptPayload = JSON.stringify({
        orderId: order.id,
        paymentId: payment.id,
        total: order.total,
        issuedAt: occurredAt,
      });
      receipt = {
        id: receiptId,
        orderId: order.id,
        paymentId: payment.id,
        issuerPubky: order.sellerPubky,
        recipientPubky: order.buyerPubky,
        total: order.total,
        contentHash: bytesToHex(blake3(new TextEncoder().encode(receiptPayload))),
        issuedAt: occurredAt,
      };
      const receiptEvent = this.createEvent(
        actorPubky,
        command,
        updatedOrder.revision,
        'receipt.issued',
        occurredAt,
        `order:${order.id}`,
      );
      eventIds.push(receiptEvent.id);
      this.repository.putReceipt(receipt);
      this.repository.appendEvent(receiptEvent);
      this.notify(order.sellerPubky, actorPubky, 'payment_confirmed', `order:${order.id}`, occurredAt);
      this.notify(order.buyerPubky, order.sellerPubky, 'payment_confirmed', `order:${order.id}`, occurredAt);
      if (updatedOrder.fulfillment === 'digital') {
        updatedOrder = {
          ...updatedOrder,
          digitalDelivery: this.buildDigitalDelivery(updatedOrder, occurredAt),
        };
      }
      const sellerNet = order.total.amountMinor - order.tax.amountMinor;
      const cashLedger = this.postBalancedLedger(
        order.id,
        occurredAt,
        [
          ['cash_sandbox', 'debit', order.total.amountMinor],
          ['buyer_receivable', 'credit', order.total.amountMinor],
          ['payout_hold', 'debit', sellerNet],
          ['seller_payable', 'credit', sellerNet],
        ],
        order.total,
      );
      if (!cashLedger.ok) return cashLedger.failure;
    }
    this.repository.putPayment(updatedPayment);
    this.repository.putOrder(updatedOrder);
    this.repository.appendEvent(paymentEvent);
    return success(command, updatedPayment.revision, eventIds, {
      kind: 'payment',
      payment: updatedPayment,
      order: updatedOrder,
      receipt,
    });
  }

  private requestCancellation(actorPubky: string, command: RequestOrderCancellationCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.buyerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the buyer may request cancellation.');
    if (!['pending_payment', 'paid', 'processing'].includes(order.state)) {
      return failure('INVALID_STATE', 'This order can no longer be cancelled.');
    }
    const occurredAt = this.now().toISOString();
    const immediate = order.state === 'pending_payment';
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: immediate ? 'cancelled' : 'cancel_requested',
      cancellationReason: command.payload.reason,
      updatedAt: occurredAt,
    };
    if (immediate) {
      const released = this.releaseOrderInventory(order, occurredAt, 'reserved');
      if (!released) return failure('INVARIANT_VIOLATION', 'Unpaid cancellation could not release reserved inventory.');
      updated.inventoryState = 'released';
    }
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      immediate ? 'order.cancelled' : 'order.cancel_requested',
      order.sellerPubky,
      'order_cancelled',
      occurredAt,
    );
  }

  private approveCancellation(actorPubky: string, command: ApproveOrderCancellationCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the seller may approve cancellation.');
    if (order.state !== 'cancel_requested') return failure('INVALID_STATE', 'No cancellation is pending.');
    const occurredAt = this.now().toISOString();
    const source = order.inventoryState === 'sold' ? 'sold' : 'reserved';
    const released = this.releaseOrderInventory(order, occurredAt, source);
    if (!released) return failure('INVARIANT_VIOLATION', 'Cancellation could not restore listing inventory.');
    const updated = {
      ...order,
      revision: order.revision + 1,
      state: 'cancelled' as const,
      inventoryState: 'released' as const,
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'order.cancelled',
      order.buyerPubky,
      'order_cancelled',
      occurredAt,
    );
  }

  private shipOrder(actorPubky: string, command: ShipOrderCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the seller may ship this order.');
    if (!['paid', 'processing'].includes(order.state))
      return failure('INVALID_STATE', 'The order is not ready to ship.');
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'shipped',
      shipment: {
        carrier: command.payload.carrier,
        trackingNumber: command.payload.trackingNumber,
        state: 'shipped',
        shippedAt: occurredAt,
        deliveredAt: null,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'fulfillment.shipped',
      order.buyerPubky,
      'order_shipped',
      occurredAt,
    );
  }

  private confirmDelivery(actorPubky: string, command: ConfirmOrderDeliveryCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.buyerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the buyer may confirm delivery.');
    if (!['shipped', 'ready_for_pickup'].includes(order.state) || !order.shipment) {
      return failure('INVALID_STATE', 'The order is not awaiting delivery confirmation.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'delivered',
      shipment: { ...order.shipment, state: 'delivered', deliveredAt: occurredAt },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'fulfillment.delivered',
      order.sellerPubky,
      'order_delivered',
      occurredAt,
    );
  }

  private requestReturn(actorPubky: string, command: RequestReturnCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.buyerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the buyer may request a return.');
    if (
      !['delivered', 'completed'].includes(order.state) ||
      command.payload.requestedAmountMinor > order.total.amountMinor
    ) {
      return failure('INVALID_STATE', 'The order is not eligible for this return amount.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'return_requested',
      returnRequest: {
        state: 'requested',
        reason: command.payload.reason,
        requestedAmountMinor: command.payload.requestedAmountMinor,
        offeredAmountMinor: null,
        requestedAt: occurredAt,
        updatedAt: occurredAt,
        returnShipment: null,
        inspection: null,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'return.requested',
      order.sellerPubky,
      'return_updated',
      occurredAt,
    );
  }

  private approveReturn(actorPubky: string, command: ApproveReturnCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the seller may approve this return.');
    if (order.state !== 'return_requested' || !order.returnRequest) {
      return failure('INVALID_STATE', 'No return is pending approval.');
    }
    const occurredAt = this.now().toISOString();
    const nextState = order.fulfillment === 'digital' ? 'return_inspection' : 'return_in_transit';
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: nextState,
      returnRequest: {
        ...order.returnRequest,
        state: nextState === 'return_inspection' ? 'inspection' : 'approved',
        updatedAt: occurredAt,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'return.approved',
      order.buyerPubky,
      'return_updated',
      occurredAt,
    );
  }

  private shipReturn(actorPubky: string, command: ShipReturnCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.buyerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the buyer may ship this return.');
    if (order.state !== 'return_in_transit' || !order.returnRequest) {
      return failure('INVALID_STATE', 'The return is not awaiting shipment.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      returnRequest: {
        ...order.returnRequest,
        state: 'in_transit',
        returnShipment: {
          carrier: command.payload.carrier,
          trackingNumber: command.payload.trackingNumber,
          shippedAt: occurredAt,
        },
        updatedAt: occurredAt,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'return.shipped',
      order.sellerPubky,
      'return_updated',
      occurredAt,
    );
  }

  private receiveReturn(actorPubky: string, command: ReceiveReturnCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the seller may receive this return.');
    if (order.state !== 'return_in_transit' || !order.returnRequest) {
      return failure('INVALID_STATE', 'The return is not in transit.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'return_inspection',
      returnRequest: { ...order.returnRequest, state: 'inspection', updatedAt: occurredAt },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'return.received',
      order.buyerPubky,
      'return_updated',
      occurredAt,
    );
  }

  private inspectReturn(actorPubky: string, command: InspectReturnCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the seller may inspect this return.');
    if (order.state !== 'return_inspection' || !order.returnRequest) {
      return failure('INVALID_STATE', 'The return is not awaiting inspection.');
    }
    const occurredAt = this.now().toISOString();
    const denied = command.payload.outcome === 'fail';
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: denied ? 'completed' : 'return_inspection',
      returnRequest: {
        ...order.returnRequest,
        state: denied ? 'denied' : 'inspection',
        inspection: {
          outcome: command.payload.outcome,
          notes: command.payload.notes,
          inspectedAt: occurredAt,
        },
        updatedAt: occurredAt,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'return.inspected',
      order.buyerPubky,
      'return_updated',
      occurredAt,
    );
  }

  private issueDigitalCredential(actorPubky: string, command: IssueDigitalCredentialCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the seller may issue a digital credential.');
    }
    if (order.fulfillment !== 'digital' || order.state !== 'paid') {
      return failure('INVALID_STATE', 'A digital credential can be issued only after a paid digital order.');
    }
    if (order.digitalDelivery) {
      return failure('INVALID_STATE', 'A digital credential already exists.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      digitalDelivery: this.buildDigitalDelivery(order, occurredAt),
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'fulfillment.credential_issued',
      order.buyerPubky,
      'order_delivered',
      occurredAt,
    );
  }

  private refreshDigitalCredential(
    actorPubky: string,
    command: RefreshDigitalCredentialCommand,
  ): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.buyerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the buyer may refresh this credential.');
    }
    if (!order.digitalDelivery) return failure('INVALID_STATE', 'No digital credential exists.');
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      digitalDelivery: {
        ...order.digitalDelivery,
        credentialId: randomUUID(),
        expiresAt: new Date(this.now().getTime() + 24 * 60 * 60 * 1_000).toISOString(),
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'fulfillment.credential_refreshed',
      order.sellerPubky,
      'order_delivered',
      occurredAt,
    );
  }

  private recordDigitalAccess(actorPubky: string, command: RecordDigitalAccessCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.buyerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the buyer may record digital access.');
    }
    if (!order.digitalDelivery) return failure('INVALID_STATE', 'No digital credential exists.');
    if (Date.parse(order.digitalDelivery.expiresAt) <= this.now().getTime()) {
      return failure('INVALID_STATE', 'The digital credential has expired.');
    }
    const occurredAt = this.now().toISOString();
    const integrityOk = command.payload.contentHash === order.digitalDelivery.resourceHash;
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: order.state === 'paid' ? 'delivered' : order.state,
      digitalDelivery: {
        ...order.digitalDelivery,
        accessCount: order.digitalDelivery.accessCount + 1,
        lastAccessAt: occurredAt,
        integrityOk,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'fulfillment.access_recorded',
      order.sellerPubky,
      'order_delivered',
      occurredAt,
    );
  }

  private recordExternalRefund(actorPubky: string, command: RecordExternalRefundCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command, { allowFinance: true });
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky && !isSandboxFinance(actorPubky)) {
      return failure('UNAUTHORIZED', 'Only the seller or sandbox finance may record a refund.');
    }
    if (
      !['return_inspection', 'disputed', 'cancelled'].includes(order.state) ||
      command.payload.amountMinor > order.total.amountMinor ||
      order.externalRefund
    ) {
      return failure('INVALID_STATE', 'The external refund cannot be recorded.');
    }
    const occurredAt = this.now().toISOString();
    if (order.inventoryState !== 'released') {
      const source = order.inventoryState === 'sold' ? 'sold' : 'reserved';
      const released = this.releaseOrderInventory(order, occurredAt, source);
      if (!released) return failure('INVARIANT_VIOLATION', 'External refund could not restore listing inventory.');
    }
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'refunded_external',
      inventoryState: 'released',
      externalRefund: {
        amountMinor: command.payload.amountMinor,
        transactionId: command.payload.transactionId,
        recordedAt: occurredAt,
      },
      returnRequest: order.returnRequest
        ? { ...order.returnRequest, state: 'refunded', updatedAt: occurredAt }
        : order.returnRequest,
      updatedAt: occurredAt,
    };
    const refundLedger = this.postBalancedLedger(
      order.id,
      occurredAt,
      [
        ['refund_expense', 'debit', command.payload.amountMinor],
        ['external_refund_clearing', 'credit', command.payload.amountMinor],
      ],
      order.total,
    );
    if (!refundLedger.ok) return refundLedger.failure;
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'refund.recorded_external',
      order.buyerPubky,
      'refund_recorded',
      occurredAt,
    );
  }

  private openDispute(actorPubky: string, command: OpenDisputeCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (
      ![
        'paid',
        'processing',
        'shipped',
        'delivered',
        'completed',
        'return_requested',
        'return_in_transit',
        'return_inspection',
      ].includes(order.state)
    ) {
      return failure('INVALID_STATE', 'This order cannot enter dispute.');
    }
    if (order.dispute) return failure('INVALID_STATE', 'A dispute already exists.');
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'disputed',
      dispute: {
        state: 'open',
        openedBy: actorPubky,
        reason: command.payload.reason,
        requestedRemedy: command.payload.requestedRemedy,
        resolution: null,
        rationale: null,
        openedAt: occurredAt,
        resolvedAt: null,
      },
      updatedAt: occurredAt,
    };
    const recipient = actorPubky === order.buyerPubky ? order.sellerPubky : order.buyerPubky;
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'dispute.opened',
      recipient,
      'dispute_updated',
      occurredAt,
    );
  }

  private resolveDispute(actorPubky: string, command: ResolveDisputeCommand): MarketplaceCommandResult {
    const order = this.repository.getOrder(command.payload.orderId);
    if (!order) return failure('NOT_FOUND', 'The dispute order was not found.');
    if (actorPubky !== MARKETPLACE_SANDBOX_MODERATOR) {
      return failure('UNAUTHORIZED', 'Only the sandbox moderator may resolve disputes.');
    }
    if (
      command.aggregateId !== buildMarketplaceOrderAggregateId(order.id) ||
      command.expectedRevision !== order.revision
    ) {
      return failure('REVISION_CONFLICT', 'The dispute order revision is stale.', { currentRevision: order.revision });
    }
    if (order.state !== 'disputed' || !order.dispute || order.dispute.state !== 'open') {
      return failure('INVALID_STATE', 'No open dispute can be resolved.');
    }
    const occurredAt = this.now().toISOString();
    const buyerRemedy =
      command.payload.resolution === 'buyer_refund' || command.payload.resolution === 'partial_refund';
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: buyerRemedy ? 'disputed' : 'completed',
      dispute: {
        ...order.dispute,
        state: 'resolved',
        resolution: command.payload.resolution,
        rationale: command.payload.rationale,
        resolvedAt: occurredAt,
      },
      updatedAt: occurredAt,
    };
    this.repository.putOrder(updated);
    const event = this.createEvent(
      actorPubky,
      command,
      updated.revision,
      'dispute.resolved',
      occurredAt,
      buildMarketplaceOrderAggregateId(order.id),
    );
    this.repository.appendEvent(event);
    this.notify(order.buyerPubky, actorPubky, 'dispute_updated', `order:${order.id}`, occurredAt);
    this.notify(order.sellerPubky, actorPubky, 'dispute_updated', `order:${order.id}`, occurredAt);
    return success(command, updated.revision, event.id, { kind: 'order', order: updated });
  }

  private createReview(actorPubky: string, command: CreateReviewCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (!['delivered', 'completed', 'closed'].includes(order.state)) {
      return failure('INVALID_STATE', 'The order is not eligible for review.');
    }
    if (order.reviews.some(({ reviewerPubky }) => reviewerPubky === actorPubky)) {
      return failure('INVALID_STATE', 'This participant already reviewed the order.');
    }
    const occurredAt = this.now().toISOString();
    const review: MarketplaceReview = {
      id: command.commandId,
      reviewerPubky: actorPubky,
      subjectPubky: actorPubky === order.buyerPubky ? order.sellerPubky : order.buyerPubky,
      rating: command.payload.rating,
      text: command.payload.text,
      itemAccuracy: command.payload.itemAccuracy ?? null,
      shipping: command.payload.shipping ?? null,
      communication: command.payload.communication ?? null,
      mediaHashes: command.payload.mediaHashes ?? [],
      reply: null,
      editedAt: null,
      createdAt: occurredAt,
    };
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: order.state === 'delivered' ? 'completed' : order.state,
      reviews: [...order.reviews, review],
      updatedAt: occurredAt,
    };
    this.repository.putOrder(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'review.created', occurredAt);
    this.repository.appendEvent(event);
    this.notify(review.subjectPubky, actorPubky, 'review_received', `order:${order.id}`, occurredAt);
    return success(command, updated.revision, event.id, { kind: 'review', order: updated, review });
  }

  private createReport(actorPubky: string, command: CreateMarketplaceReportCommand): MarketplaceCommandResult {
    if (command.aggregateId !== `report:${command.commandId}` || command.expectedRevision !== 0) {
      return failure('INVALID_COMMAND', 'The report aggregate identity is invalid.');
    }
    const report: MarketplaceReport = {
      id: command.commandId,
      revision: 1,
      reporterPubky: actorPubky,
      targetType: command.payload.targetType,
      targetId: command.payload.targetId,
      reason: command.payload.reason,
      details: command.payload.details,
      state: 'open',
      assignedTo: null,
      assignedAt: null,
      previousState: null,
      decisionNotes: null,
      decidedAt: null,
      createdAt: this.now().toISOString(),
    };
    this.repository.putReport(report);
    const event = this.createEvent(actorPubky, command, 1, 'trust.reported', report.createdAt);
    this.repository.appendEvent(event);
    return success(command, 1, event.id, { kind: 'report', report });
  }

  private blockConversation(
    actorPubky: string,
    command: BlockMarketplaceConversationCommand,
  ): MarketplaceCommandResult {
    const listing = this.repository.getListing(command.payload.listingAggregateId);
    if (!listing) return failure('NOT_FOUND', 'The conversation listing is unavailable.');
    const actorIsSeller = actorPubky === listing.sellerPubky;
    const peerPubky = command.payload.peerPubky;
    if (peerPubky === actorPubky) {
      return failure('INVALID_COMMAND', 'A participant cannot block themselves.');
    }
    if (!actorIsSeller && peerPubky !== listing.sellerPubky) {
      return failure('UNAUTHORIZED', 'A buyer may only block the listing seller.');
    }
    const buyerPubky = actorIsSeller ? peerPubky : actorPubky;
    const expectedConversationId = buildMarketplaceConversationAggregateId(
      listing.sellerPubky,
      buyerPubky,
      listing.listingId,
    );
    if (command.aggregateId !== expectedConversationId) {
      return failure('INVALID_COMMAND', 'The conversation aggregate id is invalid.');
    }
    const current = this.repository.getConversation(command.aggregateId);
    const currentRevision = current?.revision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      return failure('REVISION_CONFLICT', 'The conversation revision is stale.', { currentRevision });
    }
    if (current?.blockedBy.includes(actorPubky)) {
      return failure('INVALID_STATE', 'This conversation is already blocked.');
    }
    const occurredAt = this.now().toISOString();
    const systemMessage: MarketplaceMessage = {
      id: command.commandId,
      conversationId: command.aggregateId,
      listingAggregateId: listing.aggregateId,
      senderPubky: actorPubky,
      recipientPubky: actorIsSeller ? buyerPubky : listing.sellerPubky,
      kind: 'system',
      text: 'Conversation blocked. Existing messages stay visible.',
      card: listingCard(listing),
      attachments: [],
      createdAt: occurredAt,
    };
    const conversation: MarketplaceConversation = {
      id: command.aggregateId,
      listingAggregateId: listing.aggregateId,
      sellerPubky: listing.sellerPubky,
      buyerPubky,
      revision: currentRevision + 1,
      lastMessageAt: occurredAt,
      messages: [...(current?.messages ?? []), systemMessage],
      blockedBy: [...(current?.blockedBy ?? []), actorPubky],
    };
    const event = this.createEvent(actorPubky, command, conversation.revision, 'message.blocked', occurredAt);
    this.repository.putConversation(conversation);
    this.repository.appendEvent(event);
    return success(command, conversation.revision, event.id, { kind: 'conversation', conversation });
  }

  private flagRisk(actorPubky: string, command: FlagMarketplaceRiskCommand): MarketplaceCommandResult {
    if (!isSandboxRisk(actorPubky) && !isSandboxModerator(actorPubky)) {
      return failure('UNAUTHORIZED', 'Only sandbox risk or moderation may flag review signals.');
    }
    if (command.aggregateId !== `risk:${command.commandId}` || command.expectedRevision !== 0) {
      return failure('INVALID_COMMAND', 'The risk-signal aggregate identity is invalid.');
    }
    const occurredAt = this.now().toISOString();
    const signal: MarketplaceRiskSignal = {
      id: command.commandId,
      revision: 1,
      actorPubky,
      signalType: command.payload.signalType,
      targetType: command.payload.targetType,
      targetId: command.payload.targetId,
      details: command.payload.details,
      createdAt: occurredAt,
    };
    const event = this.createEvent(actorPubky, command, 1, 'trust.risk_flagged', occurredAt);
    this.repository.putRiskSignal(signal);
    this.repository.appendEvent(event);
    return success(command, 1, event.id, { kind: 'risk_signal', signal });
  }

  private addSupportNote(actorPubky: string, command: AddMarketplaceSupportNoteCommand): MarketplaceCommandResult {
    if (!isSandboxSupport(actorPubky)) {
      return failure('UNAUTHORIZED', 'Only sandbox support may add order notes.');
    }
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command, { allowSupport: true });
    if (!resolved.ok) return resolved.failure;
    const occurredAt = this.now().toISOString();
    const note: MarketplaceSupportNote = {
      id: command.commandId,
      actorPubky,
      text: command.payload.text,
      createdAt: occurredAt,
    };
    const updated: MarketplaceOrder = {
      ...resolved.order,
      revision: resolved.order.revision + 1,
      supportNotes: [...(resolved.order.supportNotes ?? []), note],
      updatedAt: occurredAt,
    };
    this.repository.putOrder(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'support.noted', occurredAt);
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, {
      kind: 'order',
      order: redactMarketplaceOrderForStaff(updated),
    });
  }

  private holdRisk(actorPubky: string, command: HoldMarketplaceRiskCommand): MarketplaceCommandResult {
    return this.mutateRiskHold(actorPubky, command, true);
  }

  private releaseRisk(actorPubky: string, command: ReleaseMarketplaceRiskCommand): MarketplaceCommandResult {
    return this.mutateRiskHold(actorPubky, command, false);
  }

  private mutateRiskHold(
    actorPubky: string,
    command: HoldMarketplaceRiskCommand | ReleaseMarketplaceRiskCommand,
    hold: boolean,
  ): MarketplaceCommandResult {
    if (!isSandboxRisk(actorPubky)) {
      return failure('UNAUTHORIZED', 'Only sandbox risk may apply or release transaction holds.');
    }
    if (command.aggregateId !== buildMarketplaceEnforcementAggregateId(command.payload.subjectPubky)) {
      return failure('INVALID_COMMAND', 'The enforcement aggregate id is invalid.');
    }
    const current = this.repository.getEnforcement(command.payload.subjectPubky);
    const currentRevision = current ? 1 : 0;
    if (command.expectedRevision !== currentRevision) {
      return failure('REVISION_CONFLICT', 'The enforcement revision is stale.', { currentRevision });
    }
    const hasHold = Boolean(current?.actions.includes('transaction_hold'));
    if (hold && hasHold) return failure('INVALID_STATE', 'A transaction hold is already in place.');
    if (!hold && !hasHold) return failure('INVALID_STATE', 'There is no transaction hold to release.');
    const occurredAt = this.now().toISOString();
    const actions = hold
      ? [...new Set([...(current?.actions ?? []), 'transaction_hold' as const])]
      : (current?.actions ?? []).filter((action) => action !== 'transaction_hold');
    const enforcement: MarketplaceEnforcement = {
      subjectPubky: command.payload.subjectPubky,
      actions,
      updatedAt: occurredAt,
    };
    this.repository.putEnforcement(enforcement);
    const event = this.createEvent(actorPubky, command, 1, hold ? 'risk.held' : 'risk.released', occurredAt);
    this.repository.appendEvent(event);
    return success(command, 1, event.id, { kind: 'enforcement', enforcement });
  }

  private editReview(actorPubky: string, command: EditReviewCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    const review = order.reviews.find(({ id }) => id === command.payload.reviewId);
    if (!review || review.reviewerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the original reviewer may edit this review.');
    }
    const occurredAt = this.now();
    if (occurredAt.getTime() - Date.parse(review.createdAt) > 48 * 60 * 60 * 1_000) {
      return failure('INVALID_STATE', 'The review edit window has closed.');
    }
    const updatedReview: MarketplaceReview = {
      ...review,
      rating: command.payload.rating,
      text: command.payload.text,
      itemAccuracy: command.payload.itemAccuracy ?? review.itemAccuracy,
      shipping: command.payload.shipping ?? review.shipping,
      communication: command.payload.communication ?? review.communication,
      mediaHashes: command.payload.mediaHashes ?? review.mediaHashes,
      editedAt: occurredAt.toISOString(),
    };
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      reviews: order.reviews.map((current) => (current.id === review.id ? updatedReview : current)),
      updatedAt: occurredAt.toISOString(),
    };
    this.repository.putOrder(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'review.edited', occurredAt.toISOString());
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, { kind: 'review', order: updated, review: updatedReview });
  }

  private replyReview(actorPubky: string, command: ReplyReviewCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    const review = order.reviews.find(({ id }) => id === command.payload.reviewId);
    if (!review) return failure('NOT_FOUND', 'The review was not found.');
    if (review.subjectPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the reviewed participant may reply.');
    }
    if (review.reply) return failure('INVALID_STATE', 'This review already has a reply.');
    const occurredAt = this.now().toISOString();
    const updatedReview: MarketplaceReview = { ...review, reply: command.payload.text };
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      reviews: order.reviews.map((current) => (current.id === review.id ? updatedReview : current)),
      updatedAt: occurredAt,
    };
    this.repository.putOrder(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'review.replied', occurredAt);
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, { kind: 'review', order: updated, review: updatedReview });
  }

  private createPromotion(actorPubky: string, command: CreatePromotionCommand): MarketplaceCommandResult {
    const expectedId = buildMarketplacePromotionAggregateId(actorPubky, command.payload.code);
    if (command.aggregateId !== expectedId || command.expectedRevision !== 0) {
      return failure('INVALID_COMMAND', 'The promotion aggregate identity is invalid.');
    }
    if (this.repository.getPromotion(actorPubky, command.payload.code)) {
      return failure('INVALID_STATE', 'That coupon code already exists.');
    }
    const occurredAt = this.now();
    const promotion: MarketplacePromotion = {
      id: command.commandId,
      sellerPubky: actorPubky,
      code: command.payload.code,
      percentOff: command.payload.percentOff,
      usageLimit: command.payload.usageLimit,
      usedCount: 0,
      expiresAt: new Date(occurredAt.getTime() + command.payload.expiresInSeconds * 1_000).toISOString(),
      createdAt: occurredAt.toISOString(),
    };
    this.repository.putPromotion(promotion);
    const event = this.createEvent(actorPubky, command, 1, 'promotion.created', occurredAt.toISOString());
    this.repository.appendEvent(event);
    return success(command, 1, event.id, { kind: 'promotion', promotion });
  }

  private blockBuyer(actorPubky: string, command: BlockBuyerCommand): MarketplaceCommandResult {
    return this.setBuyerBlock(actorPubky, command, true);
  }

  private unblockBuyer(actorPubky: string, command: UnblockBuyerCommand): MarketplaceCommandResult {
    return this.setBuyerBlock(actorPubky, command, false);
  }

  private setBuyerBlock(
    actorPubky: string,
    command: BlockBuyerCommand | UnblockBuyerCommand,
    blocked: boolean,
  ): MarketplaceCommandResult {
    if (command.aggregateId !== buildMarketplaceBlockedBuyersAggregateId(actorPubky)) {
      return failure('INVALID_COMMAND', 'The blocked-buyer aggregate identity is invalid.');
    }
    if (command.payload.buyerPubky === actorPubky) {
      return failure('INVALID_COMMAND', 'A seller cannot block themselves.');
    }
    this.repository.setBuyerBlocked(actorPubky, command.payload.buyerPubky, blocked);
    const occurredAt = this.now().toISOString();
    const event = this.createEvent(actorPubky, command, 1, blocked ? 'buyer.blocked' : 'buyer.unblocked', occurredAt);
    this.repository.appendEvent(event);
    return success(command, 1, event.id, {
      kind: 'blocked_buyer',
      sellerPubky: actorPubky,
      buyerPubky: command.payload.buyerPubky,
      blocked,
    });
  }

  private releasePayout(actorPubky: string, command: ReleasePayoutCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky)
      return failure('UNAUTHORIZED', 'Only the seller may release a sandbox payout.');
    if (order.payoutState !== 'held' || !['delivered', 'completed'].includes(order.state) || order.dispute) {
      return failure('INVALID_STATE', 'Sandbox payout is blocked by order, return, or dispute state.');
    }
    const occurredAt = this.now().toISOString();
    const amountMinor = order.total.amountMinor - order.tax.amountMinor;
    const payoutLedger = this.postBalancedLedger(
      order.id,
      occurredAt,
      [
        ['seller_payable', 'debit', amountMinor],
        ['cash_sandbox', 'credit', amountMinor],
      ],
      order.total,
    );
    if (!payoutLedger.ok) return payoutLedger.failure;
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      payoutState: 'released',
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'payout.released',
      order.buyerPubky,
      'payment_confirmed',
      occurredAt,
    );
  }

  private decideReport(actorPubky: string, command: DecideMarketplaceReportCommand): MarketplaceCommandResult {
    if (actorPubky !== MARKETPLACE_SANDBOX_MODERATOR) {
      return failure('UNAUTHORIZED', 'Only the sandbox moderator may decide reports.');
    }
    const report = this.repository.getReport(command.payload.reportId);
    if (!report) return failure('NOT_FOUND', 'The report was not found.');
    if (command.aggregateId !== `report:${report.id}` || command.expectedRevision !== report.revision) {
      return failure('REVISION_CONFLICT', 'The report revision is stale.', { currentRevision: report.revision });
    }
    if (report.state !== 'open') return failure('INVALID_STATE', 'The report is already decided.');
    const occurredAt = this.now().toISOString();
    const state = reportStateForDecision(command.payload.decision);
    const updated: MarketplaceReport = {
      ...report,
      revision: report.revision + 1,
      state,
      previousState: report.state,
      decisionNotes: command.payload.notes,
      decidedAt: occurredAt,
    };
    if (
      ['restricted', 'delisted'].includes(state) &&
      (report.targetType === 'listing' || command.payload.decision === 'visibility_limit')
    ) {
      const listing = this.repository.getListing(report.targetId);
      if (listing) {
        this.repository.putListing({ ...listing, restricted: true, updatedAt: occurredAt });
      }
    }
    const enforcementAction = enforcementForDecision(command.payload.decision);
    if (enforcementAction && report.targetType === 'user') {
      const current = this.repository.getEnforcement(report.targetId);
      this.repository.putEnforcement({
        subjectPubky: report.targetId,
        actions: [...new Set([...(current?.actions ?? []), enforcementAction])],
        updatedAt: occurredAt,
      });
    }
    this.repository.putReport(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'trust.decided', occurredAt);
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, { kind: 'report', report: updated });
  }

  private assignReport(actorPubky: string, command: AssignMarketplaceReportCommand): MarketplaceCommandResult {
    if (actorPubky !== MARKETPLACE_SANDBOX_MODERATOR) {
      return failure('UNAUTHORIZED', 'Only the sandbox moderator may assign reports.');
    }
    const report = this.repository.getReport(command.payload.reportId);
    if (!report) return failure('NOT_FOUND', 'The report was not found.');
    if (command.aggregateId !== `report:${report.id}` || command.expectedRevision !== report.revision) {
      return failure('REVISION_CONFLICT', 'The report revision is stale.', { currentRevision: report.revision });
    }
    if (report.state !== 'open') return failure('INVALID_STATE', 'Only open reports can be assigned.');
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceReport = {
      ...report,
      revision: report.revision + 1,
      assignedTo: command.payload.assigneePubky,
      assignedAt: occurredAt,
    };
    this.repository.putReport(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'trust.assigned', occurredAt);
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, { kind: 'report', report: updated });
  }

  private reverseReport(actorPubky: string, command: ReverseMarketplaceReportCommand): MarketplaceCommandResult {
    if (actorPubky !== MARKETPLACE_SANDBOX_MODERATOR) {
      return failure('UNAUTHORIZED', 'Only the sandbox moderator may reverse reports.');
    }
    const report = this.repository.getReport(command.payload.reportId);
    if (!report) return failure('NOT_FOUND', 'The report was not found.');
    if (command.aggregateId !== `report:${report.id}` || command.expectedRevision !== report.revision) {
      return failure('REVISION_CONFLICT', 'The report revision is stale.', { currentRevision: report.revision });
    }
    if (report.state === 'open') return failure('INVALID_STATE', 'Open reports cannot be reversed.');
    const occurredAt = this.now().toISOString();
    if (['restricted', 'delisted'].includes(report.state) && report.targetType === 'listing') {
      const listing = this.repository.getListing(report.targetId);
      if (listing) {
        this.repository.putListing({ ...listing, restricted: false, updatedAt: occurredAt });
      }
    }
    const updated: MarketplaceReport = {
      ...report,
      revision: report.revision + 1,
      state: 'open',
      previousState: report.state,
      decisionNotes: command.payload.notes,
      decidedAt: null,
    };
    this.repository.putReport(updated);
    const event = this.createEvent(actorPubky, command, updated.revision, 'trust.reversed', occurredAt);
    this.repository.appendEvent(event);
    return success(command, updated.revision, event.id, { kind: 'report', report: updated });
  }

  private readyForPickup(actorPubky: string, command: ReadyForPickupCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) return failure('UNAUTHORIZED', 'Only the seller may mark pickup ready.');
    if (!['paid', 'processing'].includes(order.state)) {
      return failure('INVALID_STATE', 'The order is not ready for pickup.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      state: 'ready_for_pickup',
      shipment: {
        carrier: 'local-pickup',
        trackingNumber: `PICKUP-${order.id.slice(0, 8)}`,
        state: 'ready_for_pickup',
        shippedAt: occurredAt,
        deliveredAt: null,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'fulfillment.ready_for_pickup',
      order.buyerPubky,
      'order_shipped',
      occurredAt,
    );
  }

  private offerPartialReturn(actorPubky: string, command: OfferPartialReturnCommand): MarketplaceCommandResult {
    const resolved = this.getOrderAction(actorPubky, command.payload.orderId, command);
    if (!resolved.ok) return resolved.failure;
    const order = resolved.order;
    if (order.sellerPubky !== actorPubky) {
      return failure('UNAUTHORIZED', 'Only the seller may offer a partial resolution.');
    }
    if (order.state !== 'return_requested' || !order.returnRequest) {
      return failure('INVALID_STATE', 'No return is pending a partial offer.');
    }
    if (command.payload.offeredAmountMinor > order.returnRequest.requestedAmountMinor) {
      return failure('INVALID_COMMAND', 'Partial offer cannot exceed the requested return amount.');
    }
    const occurredAt = this.now().toISOString();
    const updated: MarketplaceOrder = {
      ...order,
      revision: order.revision + 1,
      returnRequest: {
        ...order.returnRequest,
        state: 'partial_offered',
        offeredAmountMinor: command.payload.offeredAmountMinor,
        updatedAt: occurredAt,
      },
      updatedAt: occurredAt,
    };
    return this.persistOrderAction(
      actorPubky,
      command,
      updated,
      'return.partial_offered',
      order.buyerPubky,
      'return_updated',
      occurredAt,
    );
  }

  private hasEnforcement(subjectPubky: string, actions: MarketplaceEnforcementAction[]): boolean {
    const current = this.repository.getEnforcement(subjectPubky);
    return Boolean(current?.actions.some((action) => actions.includes(action)));
  }

  private postOrderLedger(
    order: MarketplaceOrder,
    occurredAt: string,
  ): { ok: true } | { ok: false; failure: MarketplaceCommandFailure } {
    return this.postBalancedLedger(
      order.id,
      occurredAt,
      [
        ['buyer_receivable', 'debit', order.total.amountMinor],
        ['discount', 'debit', order.discount.amountMinor],
        ['item_revenue', 'credit', order.subtotal.amountMinor],
        ['shipping_revenue', 'credit', order.shipping.amountMinor],
        ['tax_liability', 'credit', order.tax.amountMinor],
      ],
      order.total,
    );
  }

  private postBalancedLedger(
    orderId: string,
    createdAt: string,
    lines: Array<[MarketplaceLedgerEntry['account'], MarketplaceLedgerEntry['direction'], number]>,
    money: MarketplaceListingAggregate['unitPrice'],
  ): { ok: true } | { ok: false; failure: MarketplaceCommandFailure } {
    const active = lines.filter(([, , amountMinor]) => amountMinor > 0);
    const debit = active.reduce((total, [, direction, amount]) => total + (direction === 'debit' ? amount : 0), 0);
    const credit = active.reduce((total, [, direction, amount]) => total + (direction === 'credit' ? amount : 0), 0);
    if (debit !== credit) {
      return { ok: false, failure: failure('INVARIANT_VIOLATION', 'Ledger postings must balance.') };
    }
    this.repository.appendLedger(
      active.map(([account, direction, amountMinor]) => ({
        id: randomUUID(),
        orderId,
        account,
        direction,
        amountMinor,
        currency: money.currency,
        exponent: money.exponent,
        createdAt,
      })),
    );
    return { ok: true };
  }

  private getOrderAction(
    actorPubky: string,
    orderId: string,
    command: MarketplaceCommand,
    options: { allowFinance?: boolean; allowSupport?: boolean } = {},
  ): { ok: true; order: MarketplaceOrder } | { ok: false; failure: MarketplaceCommandFailure } {
    const order = this.repository.getOrder(orderId);
    if (!order) return { ok: false, failure: failure('NOT_FOUND', 'The order was not found.') };
    const isParticipant = actorPubky === order.buyerPubky || actorPubky === order.sellerPubky;
    const staffAllowed =
      (options.allowFinance && isSandboxFinance(actorPubky)) || (options.allowSupport && isSandboxSupport(actorPubky));
    if (!isParticipant && !staffAllowed) {
      return { ok: false, failure: failure('UNAUTHORIZED', 'Only order participants may act on it.') };
    }
    if (command.aggregateId !== buildMarketplaceOrderAggregateId(order.id)) {
      return { ok: false, failure: failure('INVALID_COMMAND', 'The order aggregate id is invalid.') };
    }
    if (command.expectedRevision !== order.revision) {
      return {
        ok: false,
        failure: failure('REVISION_CONFLICT', 'The order revision is stale.', { currentRevision: order.revision }),
      };
    }
    return { ok: true, order };
  }

  private resolveMessageCard(
    kind: MarketplaceMessageKind,
    listing: MarketplaceListingAggregate,
    card: SendMarketplaceMessageCommand['payload']['card'],
    actorPubky: string,
  ): { ok: true; card: MarketplaceMessageCard | null } | { ok: false; failure: MarketplaceCommandFailure } {
    if (kind === 'text') return { ok: true, card: null };
    if (kind === 'listing_card') {
      return { ok: true, card: listingCard(listing) };
    }
    const offer = this.repository.getOffer(card?.offerId ?? '');
    if (!offer || offer.listingAggregateId !== listing.aggregateId) {
      return { ok: false, failure: failure('NOT_FOUND', 'The offer card could not be resolved.') };
    }
    if (actorPubky !== offer.buyerPubky && actorPubky !== offer.sellerPubky) {
      return { ok: false, failure: failure('UNAUTHORIZED', 'Only offer participants may share this offer card.') };
    }
    return { ok: true, card: offerCard(listing, offer) };
  }

  private recordConversationSystemEvent(
    listing: MarketplaceListingAggregate,
    buyerPubky: string,
    actorPubky: string,
    recipientPubky: string,
    text: string,
    card: MarketplaceMessageCard | null,
    occurredAt: string,
  ): void {
    const conversationId = buildMarketplaceConversationAggregateId(listing.sellerPubky, buyerPubky, listing.listingId);
    const current = this.repository.getConversation(conversationId);
    const message: MarketplaceMessage = {
      id: randomUUID(),
      conversationId,
      listingAggregateId: listing.aggregateId,
      senderPubky: actorPubky,
      recipientPubky,
      kind: 'system',
      text,
      card,
      attachments: [],
      createdAt: occurredAt,
    };
    this.repository.putConversation({
      id: conversationId,
      listingAggregateId: listing.aggregateId,
      sellerPubky: listing.sellerPubky,
      buyerPubky,
      revision: (current?.revision ?? 0) + 1,
      lastMessageAt: occurredAt,
      messages: [...(current?.messages ?? []), message],
      blockedBy: current?.blockedBy ?? [],
    });
  }

  private buildDigitalDelivery(order: MarketplaceOrder, occurredAt: string): MarketplaceDigitalDelivery {
    const listing = this.repository.getListing(order.lines[0]?.listingAggregateId ?? '');
    return {
      credentialId: randomUUID(),
      resourceHash:
        listing?.digitalLock?.resourceHash ?? listing?.contentHash ?? order.lines[0]?.contentHash ?? '0'.repeat(64),
      issuedAt: occurredAt,
      expiresAt: new Date(this.now().getTime() + 24 * 60 * 60 * 1_000).toISOString(),
      accessCount: 0,
      lastAccessAt: null,
      integrityOk: true,
    };
  }

  private persistOrderAction(
    actorPubky: string,
    command: MarketplaceCommand,
    order: MarketplaceOrder,
    eventKind: MarketplaceEvent['kind'],
    notificationRecipient: string,
    notificationType: MarketplaceNotification['type'],
    occurredAt: string,
  ): MarketplaceCommandResult {
    this.repository.putOrder(order);
    const event = this.createEvent(
      actorPubky,
      command,
      order.revision,
      eventKind,
      occurredAt,
      buildMarketplaceOrderAggregateId(order.id),
    );
    this.repository.appendEvent(event);
    this.notify(notificationRecipient, actorPubky, notificationType, `order:${order.id}`, occurredAt);
    return success(command, order.revision, event.id, { kind: 'order', order });
  }

  private convertReservedInventoryToSold(order: MarketplaceOrder, occurredAt: string): boolean {
    return this.applyOrderInventoryDelta(order, occurredAt, { reserved: -1, sold: 1 });
  }

  private releaseOrderInventory(order: MarketplaceOrder, occurredAt: string, source: 'reserved' | 'sold'): boolean {
    if (order.inventoryState === 'released') return true;
    return source === 'reserved'
      ? this.applyOrderInventoryDelta(order, occurredAt, { reserved: -1, available: 1 })
      : this.applyOrderInventoryDelta(order, occurredAt, { sold: -1, available: 1 });
  }

  private applyOrderInventoryDelta(
    order: MarketplaceOrder,
    occurredAt: string,
    direction: { available?: number; reserved?: number; sold?: number },
  ): boolean {
    const updates: MarketplaceListingAggregate[] = [];
    for (const line of order.lines) {
      const listing = this.repository.getListing(line.listingAggregateId);
      if (!listing) return false;
      const next = applyListingQuantityDelta(listing, occurredAt, {
        available: (direction.available ?? 0) * line.quantity,
        reserved: (direction.reserved ?? 0) * line.quantity,
        sold: (direction.sold ?? 0) * line.quantity,
      });
      if (!next) return false;
      updates.push(next);
    }
    for (const listing of updates) this.repository.putListing(listing);
    return true;
  }

  private notify(
    recipientPubky: string,
    actorPubky: string,
    type: MarketplaceNotification['type'],
    aggregateId: string,
    createdAt: string,
  ): void {
    const preferences = this.getNotificationPreferences(recipientPubky);
    const enabled = [
      'order_created',
      'payment_confirmed',
      'order_cancelled',
      'order_shipped',
      'order_delivered',
      'return_updated',
      'refund_recorded',
      'dispute_updated',
      'review_received',
    ].includes(type)
      ? true
      : type === 'message_received'
        ? preferences.messages
        : type === 'outbid'
          ? preferences.bids
          : type === 'auction_won' || type === 'auction_ended'
            ? preferences.auctions
            : preferences.offers;
    if (!enabled) return;
    this.repository.appendNotification({
      id: randomUUID(),
      revision: 1,
      recipientPubky,
      actorPubky,
      type,
      aggregateId,
      createdAt,
      readAt: null,
    });
  }

  private recordAuctionManipulationSignals({
    listing,
    previousBids,
    bid,
    previousVisibleMinor,
    becameLeader,
    occurredAt,
  }: {
    listing: MarketplaceListingAggregate;
    previousBids: MarketplaceBid[];
    bid: MarketplaceBid;
    previousVisibleMinor: number;
    becameLeader: boolean;
    occurredAt: string;
  }): void {
    if (!listing.auction) return;
    const increment = listing.auction.minimumIncrement.amountMinor;
    const incrementOnly = bid.maximumAmount.amountMinor <= previousVisibleMinor + increment * 2;
    if (!incrementOnly || becameLeader) return;

    const details = `Increment-only bid from ${bid.bidderPubky} did not take the lead (max ${bid.maximumAmount.amountMinor}, visible ${previousVisibleMinor}, increment ${increment}).`;
    const alreadyFlagged = this.repository
      .getRiskSignals()
      .some(
        (signal) =>
          signal.signalType === 'auction_manipulation' &&
          signal.targetId === listing.aggregateId &&
          signal.details.includes(bid.bidderPubky),
      );
    if (alreadyFlagged) return;

    this.putAutomatedRiskSignal({
      signalType: 'auction_manipulation',
      targetType: 'auction',
      targetId: listing.aggregateId,
      details,
      occurredAt,
    });

    const incrementShillBidders = new Set(
      [...previousBids, bid]
        .filter((item) => item.maximumAmount.amountMinor <= previousVisibleMinor + increment * 2)
        .map((item) => item.bidderPubky),
    );
    if (incrementShillBidders.size < 3) return;
    const ladderDetails = `Three or more increment-only bids on ${listing.aggregateId} without taking the lead.`;
    if (
      this.repository
        .getRiskSignals()
        .some((signal) => signal.signalType === 'auction_manipulation' && signal.details === ladderDetails)
    ) {
      return;
    }
    this.putAutomatedRiskSignal({
      signalType: 'auction_manipulation',
      targetType: 'auction',
      targetId: listing.aggregateId,
      details: ladderDetails,
      occurredAt,
    });
  }

  private putAutomatedRiskSignal(input: {
    signalType: MarketplaceRiskSignalType;
    targetType: MarketplaceRiskSignal['targetType'];
    targetId: string;
    details: string;
    occurredAt: string;
  }): void {
    const signal: MarketplaceRiskSignal = {
      id: randomUUID(),
      revision: 1,
      actorPubky: MARKETPLACE_SANDBOX_MODERATOR,
      signalType: input.signalType,
      targetType: input.targetType,
      targetId: input.targetId,
      details: input.details,
      createdAt: input.occurredAt,
    };
    this.repository.putRiskSignal(signal);
    this.repository.appendEvent({
      id: randomUUID(),
      commandId: signal.id,
      aggregateId: `risk:${signal.id}`,
      revision: 1,
      actorPubky: MARKETPLACE_SANDBOX_MODERATOR,
      kind: 'trust.risk_flagged',
      occurredAt: input.occurredAt,
    });
  }

  private createEvent(
    actorPubky: string,
    command: MarketplaceCommand,
    revision: number,
    kind: MarketplaceEvent['kind'],
    occurredAt: string,
    aggregateId = command.aggregateId,
  ): MarketplaceEvent {
    return {
      id: randomUUID(),
      commandId: command.commandId,
      aggregateId,
      revision,
      actorPubky,
      kind,
      occurredAt,
    };
  }
}

function success(
  command: MarketplaceCommand,
  revision: number,
  eventIds: string | string[],
  result: MarketplaceCommandSuccess['result'],
): MarketplaceCommandSuccess {
  return {
    ok: true,
    version: 1,
    commandId: command.commandId,
    aggregateId: command.aggregateId,
    revision,
    eventIds: Array.isArray(eventIds) ? eventIds : [eventIds],
    result,
  };
}

function failure(
  code: MarketplaceCommandFailure['error']['code'],
  message: string,
  details: Pick<MarketplaceCommandFailure['error'], 'currentRevision' | 'issues'> = {},
): MarketplaceCommandFailure {
  return { ok: false, error: { code, message, ...details } };
}

function hashCommand(command: MarketplaceCommand): string {
  return createHash('sha256').update(JSON.stringify(command)).digest('hex');
}

function sameAsset(
  left: MarketplaceListingAggregate['unitPrice'],
  right: MarketplaceListingAggregate['unitPrice'],
): boolean {
  return left.currency === right.currency && left.exponent === right.exponent;
}

function normalizeHydratedOrderState(state: MarketplaceOrder['state'] | 'return_approved' | 'return_received') {
  if (state === 'return_approved') return 'return_in_transit';
  if (state === 'return_received') return 'return_inspection';
  return state;
}

function inferHydratedInventoryState(
  state: MarketplaceOrder['state'] | 'return_approved' | 'return_received',
): MarketplaceOrder['inventoryState'] {
  const normalized = normalizeHydratedOrderState(state);
  if (normalized === 'pending_payment') return 'reserved';
  if (normalized === 'cancelled' || normalized === 'refunded_external' || normalized === 'closed') return 'released';
  return 'sold';
}

function applyListingQuantityDelta(
  listing: MarketplaceListingAggregate,
  occurredAt: string,
  delta: { available: number; reserved: number; sold: number },
): MarketplaceListingAggregate | null {
  const availableQuantity = listing.availableQuantity + delta.available;
  const reservedQuantity = listing.reservedQuantity + delta.reserved;
  const soldQuantity = listing.soldQuantity + delta.sold;
  if (availableQuantity < 0 || reservedQuantity < 0 || soldQuantity < 0) return null;
  if (availableQuantity + reservedQuantity + soldQuantity !== listing.totalQuantity) return null;
  const state =
    availableQuantity === 0 && reservedQuantity === 0 && soldQuantity > 0
      ? 'sold'
      : availableQuantity === 0 && reservedQuantity > 0
        ? 'reserved'
        : 'available';
  return {
    ...listing,
    serverRevision: listing.serverRevision + 1,
    availableQuantity,
    reservedQuantity,
    soldQuantity,
    state,
    updatedAt: occurredAt,
  };
}

function formatSandboxMoney(amount: MarketplaceListingAggregate['unitPrice']): string {
  return `${(amount.amountMinor / 10 ** amount.exponent).toFixed(amount.exponent)} ${amount.currency}`;
}

function isPaidLikeOrderState(state: MarketplaceOrder['state']): boolean {
  return !['pending_payment', 'cancelled', 'refunded_external', 'closed'].includes(state);
}

function listingCard(listing: MarketplaceListingAggregate): MarketplaceMessageCard {
  return {
    type: 'listing',
    listingAggregateId: listing.aggregateId,
    listingId: listing.listingId,
    listingTitle: listing.title,
    sellerPubky: listing.sellerPubky,
  };
}

function offerCard(listing: MarketplaceListingAggregate, offer: MarketplaceOffer): MarketplaceMessageCard {
  return {
    type: 'offer',
    listingAggregateId: listing.aggregateId,
    listingId: listing.listingId,
    listingTitle: listing.title,
    sellerPubky: listing.sellerPubky,
    offerId: offer.id,
    offerAmountMinor: offer.amount.amountMinor,
    offerCurrency: offer.amount.currency,
    offerState: offer.state,
  };
}

function defaultCardText(kind: MarketplaceMessageKind, card: MarketplaceMessageCard | null): string {
  if (kind === 'listing_card') return `Shared listing: ${card?.listingTitle ?? 'Marketplace item'}`;
  if (kind === 'offer_card') {
    const amount =
      card?.offerAmountMinor != null && card.offerCurrency
        ? `${(card.offerAmountMinor / 100).toFixed(2)} ${card.offerCurrency}`
        : 'an offer';
    return `Shared offer: ${amount}`;
  }
  return '';
}

export function reconstructVisibleBidHistory(
  startingPrice: MarketplaceListingAggregate['unitPrice'],
  increment: MarketplaceListingAggregate['unitPrice'],
  bids: MarketplaceBid[],
): MarketplaceVisibleBid[] {
  const ordered = [...bids].sort((left, right) => left.sequence - right.sequence);
  const seen: MarketplaceBid[] = [];
  return ordered.map((bid) => {
    seen.push(bid);
    const ranked = [...latestBidderMaximums(seen).values()].sort(
      (left, right) =>
        right.maximumAmount.amountMinor - left.maximumAmount.amountMinor || left.sequence - right.sequence,
    );
    const leader = ranked[0];
    const runnerUp = ranked[1];
    const visibleAmount = runnerUp
      ? Math.min(leader.maximumAmount.amountMinor, runnerUp.maximumAmount.amountMinor + increment.amountMinor)
      : startingPrice.amountMinor;
    return {
      sequence: bid.sequence,
      bidderPubky: bid.bidderPubky,
      visiblePrice: { ...startingPrice, amountMinor: visibleAmount },
      createdAt: bid.createdAt,
    };
  });
}

function latestBidderMaximums(bids: MarketplaceBid[]): Map<string, MarketplaceBid> {
  const latest = new Map<string, MarketplaceBid>();
  for (const bid of bids) {
    const current = latest.get(bid.bidderPubky);
    if (
      !current ||
      bid.maximumAmount.amountMinor > current.maximumAmount.amountMinor ||
      (bid.maximumAmount.amountMinor === current.maximumAmount.amountMinor && bid.sequence < current.sequence)
    ) {
      latest.set(bid.bidderPubky, bid);
    }
  }
  return latest;
}

function hasImageSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }
  return false;
}

function reportStateForDecision(
  decision: DecideMarketplaceReportCommand['payload']['decision'],
): MarketplaceReport['state'] {
  switch (decision) {
    case 'dismiss':
      return 'dismissed';
    case 'warn':
      return 'warned';
    case 'restrict_listing':
    case 'visibility_limit':
      return 'restricted';
    case 'delist':
    case 'message_limit':
    case 'transaction_hold':
    case 'suspend':
    case 'ban':
      return 'delisted';
  }
}

function enforcementForDecision(
  decision: DecideMarketplaceReportCommand['payload']['decision'],
): MarketplaceEnforcementAction | null {
  switch (decision) {
    case 'warn':
      return 'warning';
    case 'visibility_limit':
    case 'restrict_listing':
      return 'visibility_limit';
    case 'message_limit':
      return 'message_limit';
    case 'transaction_hold':
      return 'transaction_hold';
    case 'suspend':
      return 'suspension';
    case 'ban':
      return 'ban';
    default:
      return null;
  }
}

function toAttachmentMetadata(attachment: MarketplaceStoredAttachment): MarketplaceAttachmentMetadata {
  return {
    id: attachment.id,
    senderPubky: attachment.senderPubky,
    recipientPubky: attachment.recipientPubky,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    contentHash: attachment.contentHash,
    createdAt: attachment.createdAt,
  };
}
