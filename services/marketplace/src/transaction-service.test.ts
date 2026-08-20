import { describe, expect, it } from 'vitest';
import { MARKETPLACE_REDACTED } from '../../../src/libs/commerce/staff-order';
import {
  buildMarketplaceCheckoutAggregateId,
  buildMarketplaceConversationAggregateId,
  buildMarketplaceListingAggregateId,
  buildMarketplaceOfferAggregateId,
  buildMarketplacePaymentAggregateId,
} from './contracts';
import {
  InMemoryMarketplaceRepository,
  MARKETPLACE_SANDBOX_FINANCE,
  MARKETPLACE_SANDBOX_MODERATOR,
  MARKETPLACE_SANDBOX_RISK,
  MARKETPLACE_SANDBOX_SUPPORT,
  MarketplaceTransactionService,
} from './transaction-service';

const SELLER = 'y'.repeat(52);
const BUYER = 'b'.repeat(52);
const OTHER_BUYER = 'n'.repeat(52);
const AGGREGATE_ID = buildMarketplaceListingAggregateId(SELLER, 'boots_01');
const NOW = new Date('2026-08-19T22:00:00.000Z');
const REGISTER_COMMAND_ID = '018f47d2-6a27-7c23-a49d-6b21bb770120';

function registerCommand(quantity = 1, overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    commandId: REGISTER_COMMAND_ID,
    aggregateId: AGGREGATE_ID,
    expectedRevision: 0,
    issuedAt: NOW.toISOString(),
    kind: 'listing.register',
    payload: {
      sellerPubky: SELLER,
      listingId: 'boots_01',
      listingRevision: 1,
      contentHash: 'a'.repeat(64),
      quantity,
      unitPrice: { amountMinor: 12_500, currency: 'USD', exponent: 2 },
    },
    ...overrides,
  };
}

function registerAuctionCommand() {
  return registerCommand(1, {
    commandId: '00000000-0000-4000-8000-000000000600',
    payload: {
      ...registerCommand().payload,
      listingRevision: 1,
      unitPrice: { amountMinor: 4_500, currency: 'USD', exponent: 2 },
      saleFormat: 'auction',
      auctionTerms: {
        startsAt: NOW.toISOString(),
        endsAt: new Date(NOW.getTime() + 10 * 60 * 1_000).toISOString(),
        minimumIncrement: { amountMinor: 500, currency: 'USD', exponent: 2 },
        reservePrice: { amountMinor: 6_000, currency: 'USD', exponent: 2 },
        antiSnipingWindowSeconds: 60,
        antiSnipingExtensionSeconds: 120,
      },
    },
  });
}

function reserveCommand(index = 1, quantity = 1, expectedRevision = 1) {
  return {
    version: 1,
    commandId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    aggregateId: AGGREGATE_ID,
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'inventory.reserve',
    payload: {
      quantity,
      reservationTtlSeconds: 600,
    },
  };
}

function createOfferCommand(quantity = 1) {
  return {
    version: 1,
    commandId: '00000000-0000-4000-8000-000000000500',
    aggregateId: AGGREGATE_ID,
    expectedRevision: 1,
    issuedAt: NOW.toISOString(),
    kind: 'offer.create',
    payload: {
      amount: { amountMinor: 10_000, currency: 'USD', exponent: 2 },
      quantity,
      expiresInSeconds: 3_600,
      message: 'Would you take this?',
    },
  };
}

function offerAction(
  kind: 'offer.accept' | 'offer.reject' | 'offer.withdraw',
  expectedRevision: number,
  commandId: string,
) {
  const offerId = createOfferCommand().commandId;
  return {
    version: 1,
    commandId,
    aggregateId: buildMarketplaceOfferAggregateId(offerId),
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind,
    payload: { offerId },
  };
}

function counterOfferCommand(expectedRevision = 1) {
  const offerId = createOfferCommand().commandId;
  return {
    version: 1,
    commandId: '00000000-0000-4000-8000-000000000501',
    aggregateId: buildMarketplaceOfferAggregateId(offerId),
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'offer.counter',
    payload: {
      offerId,
      amount: { amountMinor: 11_000, currency: 'USD', exponent: 2 },
      quantity: 1,
      expiresInSeconds: 3_600,
      message: 'Meet me here.',
    },
  };
}

function placeBidCommand(actorIndex: number, maximumMinor: number, expectedRevision: number) {
  return {
    version: 1,
    commandId: `00000000-0000-4000-8001-${actorIndex.toString().padStart(12, '0')}`,
    aggregateId: AGGREGATE_ID,
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'auction.place_bid',
    payload: {
      maximumAmount: { amountMinor: maximumMinor, currency: 'USD', exponent: 2 },
    },
  };
}

function messageCommand(sender: string, recipient: string, expectedRevision: number, commandId: string, text: string) {
  const buyer = sender === SELLER ? recipient : sender;
  return {
    version: 1,
    commandId,
    aggregateId: buildMarketplaceConversationAggregateId(SELLER, buyer, 'boots_01'),
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'message.send',
    payload: {
      listingAggregateId: AGGREGATE_ID,
      recipientPubky: recipient,
      text,
      attachmentIds: [] as string[],
    },
  };
}

function closeAuctionCommand(expectedRevision: number, commandNumber = 950) {
  return {
    version: 1,
    commandId: `00000000-0000-4000-8000-${commandNumber.toString().padStart(12, '0')}`,
    aggregateId: AGGREGATE_ID,
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'auction.close',
    payload: {},
  };
}

function notificationPreferencesCommand(expectedRevision: number, messages: boolean, commandNumber = 960) {
  return {
    version: 1,
    commandId: `00000000-0000-4000-8000-${commandNumber.toString().padStart(12, '0')}`,
    aggregateId: `notification_preferences:${SELLER}`,
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'notification.preferences.update',
    payload: { messages, offers: true, bids: true, auctions: true },
  };
}

function checkoutCommand() {
  const commandId = '00000000-0000-4000-8000-000000001000';
  return {
    version: 1,
    commandId,
    aggregateId: buildMarketplaceCheckoutAggregateId(commandId),
    expectedRevision: 0,
    issuedAt: NOW.toISOString(),
    kind: 'checkout.create',
    payload: {
      lines: [{ listingAggregateId: AGGREGATE_ID, expectedRevision: 1, quantity: 1 }],
      deliveryAddress: {
        name: 'Alice Buyer',
        line1: '1 Market Street',
        line2: '',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        countryCode: 'US',
      },
      guaranteePolicyVersion: 1,
    },
  };
}

function paymentCommand(
  paymentId: string,
  expectedRevision: number,
  target: 'detected' | 'confirmed' | 'expired' | 'manual_review',
  confirmations: number,
  commandNumber: number,
) {
  return {
    version: 1,
    commandId: `00000000-0000-4000-8000-${commandNumber.toString().padStart(12, '0')}`,
    aggregateId: buildMarketplacePaymentAggregateId(paymentId),
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind: 'payment.sandbox_advance',
    payload: { paymentId, target, confirmations },
  };
}

function orderCommand(
  kind: string,
  orderId: string,
  expectedRevision: number,
  payload: Record<string, unknown>,
  commandNumber: number,
) {
  return {
    version: 1,
    commandId: `00000000-0000-4000-8000-${commandNumber.toString().padStart(12, '0')}`,
    aggregateId: `order:${orderId}`,
    expectedRevision,
    issuedAt: NOW.toISOString(),
    kind,
    payload: { orderId, ...payload },
  };
}

function createService() {
  const repository = new InMemoryMarketplaceRepository();
  return {
    repository,
    service: new MarketplaceTransactionService(repository, () => new Date(NOW)),
  };
}

async function createPaidOrder(service: MarketplaceTransactionService) {
  await service.execute(SELLER, registerCommand());
  const checkout = await service.execute(BUYER, checkoutCommand());
  if (!checkout.ok || checkout.result.kind !== 'checkout') throw new Error('Checkout fixture failed');
  const payment = checkout.result.payments[0];
  const confirmed = await service.execute(BUYER, paymentCommand(payment.id, 1, 'confirmed', 1, 1_050));
  if (!confirmed.ok || confirmed.result.kind !== 'payment') throw new Error('Payment fixture failed');
  return confirmed.result.order;
}

describe('MarketplaceTransactionService', () => {
  it('registers seller-owned inventory at revision one', async () => {
    const { repository, service } = createService();

    const result = await service.execute(SELLER, registerCommand());

    expect(result).toMatchObject({
      ok: true,
      aggregateId: AGGREGATE_ID,
      revision: 1,
      result: {
        kind: 'listing',
        listing: {
          availableQuantity: 1,
          reservedQuantity: 0,
          serverRevision: 1,
          state: 'available',
        },
      },
    });
    expect(repository.getEvents()).toHaveLength(1);
  });

  it('rejects registration by anyone other than the public listing seller', async () => {
    const { service } = createService();

    await expect(service.execute(BUYER, registerCommand())).resolves.toEqual({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Only the listing seller may register inventory.',
      },
    });
  });

  it('returns the exact stored result for an idempotent replay', async () => {
    const { repository, service } = createService();
    const command = registerCommand();

    const first = await service.execute(SELLER, command);
    const replay = await service.execute(SELLER, command);

    expect(replay).toEqual(first);
    expect(repository.getEvents()).toHaveLength(1);
  });

  it('rejects changed input under an already accepted command id', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());

    const changed = registerCommand(2);

    await expect(service.execute(SELLER, changed)).resolves.toEqual({
      ok: false,
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'The command id was already used with different input.',
      },
    });
  });

  it('allows exactly one of 100 concurrent buyers to reserve one unit', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) => service.execute(BUYER, reserveCommand(index + 1))),
    );
    const accepted = results.filter(({ ok }) => ok);
    const rejected = results.filter(({ ok }) => !ok);

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(99);
    expect(rejected.every((result) => !result.ok && result.error.code === 'REVISION_CONFLICT')).toBe(true);
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      availableQuantity: 0,
      reservedQuantity: 1,
      serverRevision: 2,
      state: 'reserved',
    });
    expect(repository.getEvents()).toHaveLength(2);
  });

  it('uses server time for reservation expiry', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());

    const result = await service.execute(BUYER, reserveCommand());

    expect(result).toMatchObject({
      ok: true,
      result: {
        kind: 'reservation',
        reservation: {
          createdAt: '2026-08-19T22:00:00.000Z',
          expiresAt: '2026-08-19T22:10:00.000Z',
        },
      },
    });
  });

  it('rejects seller self-reservation and stale buyer revisions', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());

    await expect(service.execute(SELLER, reserveCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(service.execute(BUYER, reserveCommand(2, 1, 0))).resolves.toMatchObject({
      ok: false,
      error: { code: 'REVISION_CONFLICT', currentRevision: 1 },
    });
  });

  it('prevents a seller update from reducing total quantity below reservations', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand(2));
    await service.execute(BUYER, reserveCommand(1, 2));
    const update = registerCommand(1, {
      commandId: '018f47d2-6a27-7c23-a49d-6b21bb770121',
      expectedRevision: 2,
      payload: {
        ...registerCommand(1).payload,
        listingRevision: 2,
      },
    });

    await expect(service.execute(SELLER, update)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVARIANT_VIOLATION', currentRevision: 2 },
    });
  });

  it('returns redacted validation issues for malformed commands', async () => {
    const { service } = createService();

    const result = await service.execute('not-a-pubky', {
      ...registerCommand(),
      privateAddress: 'secret-address',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_COMMAND',
        issues: expect.any(Array),
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret-address');
  });

  it('supports private offer, counteroffer, and atomic acceptance history', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand(2));

    const created = await service.execute(BUYER, createOfferCommand());
    const countered = await service.execute(SELLER, counterOfferCommand());
    const accepted = await service.execute(
      BUYER,
      offerAction('offer.accept', 2, '00000000-0000-4000-8000-000000000502'),
    );

    expect(created).toMatchObject({
      ok: true,
      revision: 1,
      result: { kind: 'offer', offer: { buyerPubky: BUYER, sellerPubky: SELLER, state: 'pending' } },
    });
    expect(countered).toMatchObject({
      ok: true,
      revision: 2,
      result: { kind: 'offer', offer: { state: 'countered', offeredBy: SELLER, amount: { amountMinor: 11_000 } } },
    });
    expect(accepted).toMatchObject({
      ok: true,
      revision: 3,
      eventIds: expect.arrayContaining([expect.any(String), expect.any(String)]),
      result: {
        kind: 'accepted_offer',
        offer: { state: 'accepted', revision: 3 },
        listing: { availableQuantity: 1, reservedQuantity: 1, serverRevision: 2 },
        reservation: { buyerPubky: BUYER, quantity: 1 },
      },
    });
    expect(repository.getOffer(createOfferCommand().commandId)?.history.map(({ action }) => action)).toEqual([
      'created',
      'countered',
      'accepted',
    ]);
  });

  it('enforces participant roles for counter, reject, and withdraw', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await service.execute(BUYER, createOfferCommand());

    await expect(service.execute(BUYER, counterOfferCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(service.execute(OTHER_BUYER, counterOfferCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(
      service.execute(SELLER, offerAction('offer.withdraw', 1, '00000000-0000-4000-8000-000000000503')),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(
      service.execute(BUYER, offerAction('offer.reject', 1, '00000000-0000-4000-8000-000000000504')),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('supports rejection by the recipient and withdrawal by the current author', async () => {
    const rejectedService = createService().service;
    await rejectedService.execute(SELLER, registerCommand());
    await rejectedService.execute(BUYER, createOfferCommand());
    await expect(
      rejectedService.execute(SELLER, offerAction('offer.reject', 1, '00000000-0000-4000-8000-000000000505')),
    ).resolves.toMatchObject({ ok: true, result: { offer: { state: 'rejected' } } });

    const withdrawnService = createService().service;
    await withdrawnService.execute(SELLER, registerCommand());
    await withdrawnService.execute(BUYER, createOfferCommand());
    await expect(
      withdrawnService.execute(BUYER, offerAction('offer.withdraw', 1, '00000000-0000-4000-8000-000000000506')),
    ).resolves.toMatchObject({ ok: true, result: { offer: { state: 'withdrawn' } } });
  });

  it('does not accept an offer after another buyer reserves the inventory', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await service.execute(BUYER, createOfferCommand());
    await service.execute(OTHER_BUYER, reserveCommand(20));

    await expect(
      service.execute(SELLER, offerAction('offer.accept', 1, '00000000-0000-4000-8000-000000000507')),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_INVENTORY' },
    });
  });

  it('rejects actions after server-time offer expiry', async () => {
    let now = new Date(NOW);
    const repository = new InMemoryMarketplaceRepository();
    const service = new MarketplaceTransactionService(repository, () => new Date(now));
    await service.execute(SELLER, registerCommand());
    await service.execute(BUYER, createOfferCommand());
    now = new Date(NOW.getTime() + 3_601_000);

    await expect(service.execute(SELLER, counterOfferCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'OFFER_EXPIRED' },
    });
  });

  it('applies deterministic proxy bidding and reserve status', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerAuctionCommand());

    const first = await service.execute(BUYER, placeBidCommand(1, 10_000, 1));
    const second = await service.execute(OTHER_BUYER, placeBidCommand(2, 8_000, 2));

    expect(first).toMatchObject({
      ok: true,
      result: {
        kind: 'bid',
        listing: {
          auction: {
            currentPrice: { amountMinor: 4_500 },
            leaderPubky: BUYER,
            reserveMet: false,
            bidCount: 1,
          },
        },
      },
    });
    expect(second).toMatchObject({
      ok: true,
      revision: 3,
      result: {
        kind: 'bid',
        listing: {
          auction: {
            currentPrice: { amountMinor: 8_500 },
            leaderPubky: BUYER,
            reserveMet: true,
            bidCount: 2,
          },
        },
      },
    });
    expect(repository.getBidsForListing(AGGREGATE_ID)).toHaveLength(2);
  });

  it('uses first accepted sequence as the proxy-bid tie breaker', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerAuctionCommand());
    await service.execute(BUYER, placeBidCommand(1, 10_000, 1));
    await service.execute(OTHER_BUYER, placeBidCommand(2, 10_000, 2));

    expect(repository.getListing(AGGREGATE_ID)?.auction).toMatchObject({
      currentPrice: { amountMinor: 10_000 },
      leaderPubky: BUYER,
    });
  });

  it('rejects seller, low, stale, and post-close bids', async () => {
    let now = new Date(NOW);
    const repository = new InMemoryMarketplaceRepository();
    const service = new MarketplaceTransactionService(repository, () => new Date(now));
    await service.execute(SELLER, registerAuctionCommand());

    await expect(service.execute(SELLER, placeBidCommand(1, 10_000, 1))).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(service.execute(BUYER, placeBidCommand(2, 4_500, 1))).resolves.toMatchObject({
      ok: false,
      error: { code: 'BID_TOO_LOW' },
    });
    await service.execute(BUYER, placeBidCommand(3, 10_000, 1));
    await expect(service.execute(OTHER_BUYER, placeBidCommand(4, 11_000, 1))).resolves.toMatchObject({
      ok: false,
      error: { code: 'REVISION_CONFLICT', currentRevision: 2 },
    });
    now = new Date(NOW.getTime() + 11 * 60 * 1_000);
    await expect(service.execute(OTHER_BUYER, placeBidCommand(5, 11_000, 2))).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUCTION_CLOSED' },
    });
  });

  it('extends an auction when a valid bid lands inside the anti-sniping window', async () => {
    let now = new Date(NOW);
    const repository = new InMemoryMarketplaceRepository();
    const service = new MarketplaceTransactionService(repository, () => new Date(now));
    await service.execute(SELLER, registerAuctionCommand());
    now = new Date(NOW.getTime() + 9 * 60 * 1_000 + 30_000);

    await service.execute(BUYER, placeBidCommand(1, 10_000, 1));

    expect(repository.getListing(AGGREGATE_ID)?.auction?.endsAt).toBe(new Date(now.getTime() + 120_000).toISOString());
  });

  it('stores participant-only listing messages with immutable revisions', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());

    const first = await service.execute(
      BUYER,
      messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000000900', 'Is this still available?'),
    );
    const reply = await service.execute(
      SELLER,
      messageCommand(SELLER, BUYER, 1, '00000000-0000-4000-8000-000000000901', 'Yes, it is.'),
    );

    expect(first).toMatchObject({ ok: true, revision: 1, result: { kind: 'message' } });
    expect(reply).toMatchObject({
      ok: true,
      revision: 2,
      result: { conversation: { messages: [{ text: 'Is this still available?' }, { text: 'Yes, it is.' }] } },
    });
    expect(service.getParticipantConversations(BUYER)).toHaveLength(1);
    expect(service.getParticipantConversations(SELLER)).toHaveLength(1);
    expect(service.getParticipantConversations(OTHER_BUYER)).toEqual([]);
    expect(repository.getEvents().filter(({ kind }) => kind === 'message.sent')).toHaveLength(2);
  });

  it('rejects unrelated message recipients and stale conversation revisions', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());

    await expect(
      service.execute(BUYER, messageCommand(BUYER, OTHER_BUYER, 0, '00000000-0000-4000-8000-000000000902', 'Private')),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });

    await service.execute(BUYER, messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000000903', 'First'));
    await expect(
      service.execute(BUYER, messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000000904', 'Stale')),
    ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_CONFLICT', currentRevision: 1 } });
  });

  it('validates image signatures and binds one-use private attachments to messages', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02]);
    const stored = service.storeAttachment(BUYER, SELLER, 'image/jpeg', bytes);
    expect(stored).toMatchObject({
      ok: true,
      attachment: {
        senderPubky: BUYER,
        recipientPubky: SELLER,
        mimeType: 'image/jpeg',
        byteSize: 5,
      },
    });
    if (!stored.ok) return;
    const command = messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000000906', 'Photo attached');
    command.payload.attachmentIds = [stored.attachment.id];

    await expect(service.execute(BUYER, command)).resolves.toMatchObject({
      ok: true,
      result: {
        kind: 'message',
        message: {
          attachments: [{ id: stored.attachment.id, contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) }],
        },
      },
    });
    expect(service.getAttachment(BUYER, stored.attachment.id)?.bytes).toEqual(bytes);
    expect(service.getAttachment(SELLER, stored.attachment.id)?.bytes).toEqual(bytes);
    expect(service.getAttachment(OTHER_BUYER, stored.attachment.id)).toBeNull();

    const reused = messageCommand(BUYER, SELLER, 1, '00000000-0000-4000-8000-000000000907', 'Reuse');
    reused.payload.attachmentIds = [stored.attachment.id];
    await expect(service.execute(BUYER, reused)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_COMMAND' },
    });
  });

  it('rejects spoofed and oversized attachment payloads', () => {
    const { service } = createService();

    expect(service.storeAttachment(BUYER, SELLER, 'image/jpeg', new Uint8Array([1, 2, 3]))).toMatchObject({
      ok: false,
      code: 'INVALID_ATTACHMENT',
    });
    expect(
      service.storeAttachment(BUYER, SELLER, 'image/svg+xml', new Uint8Array([0x3c, 0x73, 0x76, 0x67])),
    ).toMatchObject({
      ok: false,
      code: 'INVALID_ATTACHMENT',
    });
    expect(service.storeAttachment(BUYER, SELLER, 'image/png', new Uint8Array(5 * 1024 * 1024 + 1))).toMatchObject({
      ok: false,
      code: 'INVALID_ATTACHMENT',
    });
  });

  it('emits role-scoped message, offer, and outbid notifications', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerAuctionCommand());
    await service.execute(BUYER, messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000000905', 'Hello'));
    await service.execute(BUYER, createOfferCommand());
    await service.execute(BUYER, placeBidCommand(10, 10_000, 1));
    await service.execute(OTHER_BUYER, placeBidCommand(11, 12_000, 2));

    expect(
      service
        .getNotifications(SELLER)
        .map(({ type }) => type)
        .sort(),
    ).toEqual(['message_received', 'offer_received']);
    expect(service.getNotifications(BUYER).map(({ type }) => type)).toContain('outbid');
    expect(service.getNotifications(OTHER_BUYER)).toEqual([]);
  });

  it('closes a reserve-met auction with one winner and reservation', async () => {
    let now = new Date(NOW);
    const repository = new InMemoryMarketplaceRepository();
    const service = new MarketplaceTransactionService(repository, () => new Date(now));
    await service.execute(SELLER, registerAuctionCommand());
    await service.execute(BUYER, placeBidCommand(20, 10_000, 1));
    await service.execute(OTHER_BUYER, placeBidCommand(21, 8_000, 2));
    now = new Date(NOW.getTime() + 11 * 60 * 1_000);

    const result = await service.execute(SELLER, closeAuctionCommand(3));

    expect(result).toMatchObject({
      ok: true,
      revision: 4,
      result: {
        kind: 'auction_result',
        outcome: 'sold',
        winnerPubky: BUYER,
        listing: { state: 'reserved', auction: { status: 'sold' } },
        reservation: { buyerPubky: BUYER, quantity: 1 },
      },
    });
    expect(service.getNotifications(BUYER).map(({ type }) => type)).toContain('auction_won');
    await expect(service.execute(SELLER, closeAuctionCommand(4, 951))).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
  });

  it('closes an auction without a reserve-met leader as unsold', async () => {
    let now = new Date(NOW);
    const repository = new InMemoryMarketplaceRepository();
    const service = new MarketplaceTransactionService(repository, () => new Date(now));
    await service.execute(SELLER, registerAuctionCommand());
    now = new Date(NOW.getTime() + 11 * 60 * 1_000);

    await expect(service.execute(SELLER, closeAuctionCommand(1))).resolves.toMatchObject({
      ok: true,
      result: {
        kind: 'auction_result',
        outcome: 'unsold',
        winnerPubky: null,
        listing: { state: 'available', auction: { status: 'unsold' } },
        reservation: null,
      },
    });
  });

  it('applies revisioned notification preferences before delivery', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await service.execute(SELLER, notificationPreferencesCommand(0, false));
    await service.execute(
      BUYER,
      messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000000970', 'Muted message'),
    );
    await service.execute(BUYER, createOfferCommand());

    expect(service.getNotificationPreferences(SELLER)).toMatchObject({ revision: 1, messages: false, offers: true });
    expect(service.getNotifications(SELLER).map(({ type }) => type)).toEqual(['offer_received']);
    await expect(service.execute(SELLER, notificationPreferencesCommand(0, true, 961))).resolves.toMatchObject({
      ok: false,
      error: { code: 'REVISION_CONFLICT', currentRevision: 1 },
    });
  });

  it('allows only a notification recipient to mark it read once', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await service.execute(BUYER, createOfferCommand());
    const notification = service.getNotifications(SELLER)[0];
    const command = {
      version: 1,
      commandId: '00000000-0000-4000-8000-000000000971',
      aggregateId: `notification:${notification.id}`,
      expectedRevision: notification.revision,
      issuedAt: NOW.toISOString(),
      kind: 'notification.mark_read',
      payload: { notificationId: notification.id },
    };

    await expect(service.execute(BUYER, command)).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    await expect(service.execute(SELLER, command)).resolves.toMatchObject({
      ok: true,
      result: { kind: 'notification', notification: { revision: 2, readAt: NOW.toISOString() } },
    });
    await expect(
      service.execute(SELLER, {
        ...command,
        commandId: '00000000-0000-4000-8000-000000000972',
        expectedRevision: 2,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
  });

  it('quotes listing-level free shipping on checkout instead of the flat sandbox default', async () => {
    const { service } = createService();
    const jacketId = buildMarketplaceListingAggregateId(SELLER, 'denim_jacket');
    await service.execute(SELLER, {
      ...registerCommand(2, {
        commandId: '00000000-0000-4000-8000-000000001180',
        aggregateId: jacketId,
        payload: {
          ...registerCommand().payload,
          listingId: 'denim_jacket',
          unitPrice: { amountMinor: 8_800, currency: 'USD', exponent: 2 },
          fulfillment: 'physical',
          shippingQuoteMinor: 0,
        },
      }),
    });

    const result = await service.execute(BUYER, {
      ...checkoutCommand(),
      commandId: '00000000-0000-4000-8000-000000001181',
      aggregateId: buildMarketplaceCheckoutAggregateId('00000000-0000-4000-8000-000000001181'),
      payload: {
        ...checkoutCommand().payload,
        lines: [{ listingAggregateId: jacketId, expectedRevision: 1, quantity: 1 }],
      },
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        kind: 'checkout',
        orders: [
          {
            shipping: { amountMinor: 0 },
            tax: { amountMinor: 704 },
            total: { amountMinor: 9_504 },
            shippingAdapterVersion: 'sandbox-listing-shipping-v1',
          },
        ],
      },
    });
  });

  it('creates an immutable checkout snapshot, reservation, order, and sandbox payment', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());

    const result = await service.execute(BUYER, checkoutCommand());

    expect(result).toMatchObject({
      ok: true,
      revision: 1,
      result: {
        kind: 'checkout',
        orders: [
          {
            buyerPubky: BUYER,
            sellerPubky: SELLER,
            state: 'pending_payment',
            subtotal: { amountMinor: 12_500 },
            shipping: { amountMinor: 1_200 },
            tax: { amountMinor: 1_096 },
            total: { amountMinor: 14_796 },
            guaranteePolicyVersion: 1,
            taxAdapterVersion: 'sandbox-us-8pct-v1',
            shippingAdapterVersion: 'sandbox-listing-shipping-v1',
            lines: [{ listingRevision: 1, contentHash: 'a'.repeat(64), quantity: 1 }],
          },
        ],
        payments: [{ state: 'awaiting_entitlement', adapter: 'sandbox', amount: { amountMinor: 14_796 } }],
      },
    });
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      state: 'reserved',
      availableQuantity: 0,
      reservedQuantity: 1,
      serverRevision: 2,
    });
    expect(service.getOrders(BUYER)).toHaveLength(1);
    expect(service.getOrders(SELLER)).toHaveLength(1);
    expect(service.getOrders(OTHER_BUYER)).toEqual([]);
    expect(service.getNotifications(SELLER).map(({ type }) => type)).toContain('order_created');
    expect(service.getNotifications(BUYER).map(({ type }) => type)).toContain('order_created');
  });

  it('advances sandbox payment through detection to confirmation and issues a receipt', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') return;
    const payment = checkout.result.payments[0];

    await expect(service.execute(BUYER, paymentCommand(payment.id, 1, 'detected', 0, 1_001))).resolves.toMatchObject({
      ok: true,
      result: { kind: 'payment', payment: { state: 'detected', revision: 2 }, receipt: null },
    });
    const confirmed = await service.execute(BUYER, paymentCommand(payment.id, 2, 'confirmed', 1, 1_002));

    expect(confirmed).toMatchObject({
      ok: true,
      result: {
        kind: 'payment',
        payment: { state: 'confirmed', confirmations: 1, revision: 3 },
        order: { state: 'paid', revision: 2, receiptId: expect.any(String) },
        receipt: { contentHash: expect.stringMatching(/^[a-f0-9]{64}$/), total: { amountMinor: 14_796 } },
      },
    });
    if (!confirmed.ok || confirmed.result.kind !== 'payment' || !confirmed.result.receipt) return;
    expect(service.getReceipt(BUYER, confirmed.result.receipt.id)).toEqual(confirmed.result.receipt);
    expect(service.getReceipt(OTHER_BUYER, confirmed.result.receipt.id)).toBeNull();
    expect(service.getNotifications(SELLER).map(({ type }) => type)).toContain('payment_confirmed');
    expect(service.getNotifications(BUYER).map(({ type }) => type)).toContain('payment_confirmed');
    expect(service.getListingProjection(AGGREGATE_ID)).toMatchObject({
      state: 'sold',
      availableQuantity: 0,
      reservedQuantity: 0,
      soldQuantity: 1,
      serverRevision: 3,
    });
  });

  it('applies a signed payment observation as the buyer without a browser CSRF session', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') return;
    const payment = checkout.result.payments[0];

    const confirmed = await service.applySignedPaymentObservation({
      version: 1,
      paymentId: payment.id,
      target: 'confirmed',
      confirmations: 1,
      commandId: '00000000-0000-4000-8000-000000001910',
    });

    expect(confirmed).toMatchObject({
      ok: true,
      result: { kind: 'payment', payment: { state: 'confirmed' }, order: { state: 'paid' } },
    });
    await expect(
      service.applySignedPaymentObservation({
        version: 1,
        paymentId: payment.id,
        target: 'confirmed',
        confirmations: 1,
        commandId: '00000000-0000-4000-8000-000000001911',
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });

  it('expires an unpaid sandbox payment, cancels the order, and releases reserved inventory', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') return;
    const payment = checkout.result.payments[0];

    await expect(service.execute(BUYER, paymentCommand(payment.id, 1, 'expired', 0, 1_003))).resolves.toMatchObject({
      ok: true,
      result: {
        kind: 'payment',
        payment: { state: 'expired' },
        order: { state: 'cancelled', inventoryState: 'released' },
      },
    });
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      state: 'available',
      availableQuantity: 1,
      reservedQuantity: 0,
      soldQuantity: 0,
    });
  });

  it('restocks sold inventory once after a paid cancellation', async () => {
    const { repository, service } = createService();
    const order = await createPaidOrder(service);

    await expect(
      service.execute(BUYER, orderCommand('order.cancel_request', order.id, 2, { reason: 'Need to cancel' }, 1_060)),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'cancel_requested' } } });
    await expect(
      service.execute(SELLER, orderCommand('order.cancel_approve', order.id, 3, {}, 1_061)),
    ).resolves.toMatchObject({
      ok: true,
      result: { order: { state: 'cancelled', inventoryState: 'released' } },
    });
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      state: 'available',
      availableQuantity: 1,
      reservedQuantity: 0,
      soldQuantity: 0,
    });
  });

  it('records listing views without advancing inventory revision and exposes seller analytics', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const viewed = await service.execute(BUYER, {
      version: 1,
      commandId: '00000000-0000-4000-8000-000000000110',
      aggregateId: AGGREGATE_ID,
      expectedRevision: 0,
      issuedAt: NOW.toISOString(),
      kind: 'listing.view',
      payload: {},
    });

    expect(viewed).toMatchObject({
      ok: true,
      result: { kind: 'view', counted: true, viewCount: 1 },
    });
    expect(service.getListingProjection(AGGREGATE_ID)).toMatchObject({
      serverRevision: 1,
      viewCount: 1,
      watcherCount: 0,
    });
    expect(service.getSellerAnalytics(SELLER)).toMatchObject({
      views: 1,
      favorites: 0,
      soldQuantity: 0,
      totalQuantity: 1,
      sellThroughPercent: 0,
      conversionPercent: 0,
      paidOrders: 0,
    });

    const paid = await createPaidOrder(service);
    expect(paid.inventoryState).toBe('sold');
    expect(service.getSellerAnalytics(SELLER)).toMatchObject({
      soldQuantity: 1,
      sellThroughPercent: 100,
      paidOrders: 1,
      conversionPercent: 100,
    });
  });

  it('reconciles leftover reserved inventory on already-paid orders without rewriting payment events', async () => {
    const { repository, service } = createService();
    const order = await createPaidOrder(service);
    const listing = repository.getListing(AGGREGATE_ID);
    if (!listing) throw new Error('Expected registered listing');
    repository.putListing({
      ...listing,
      state: 'reserved',
      reservedQuantity: listing.soldQuantity,
      soldQuantity: 0,
    });
    repository.putOrder({ ...order, inventoryState: 'reserved' });

    expect(service.getInvariants().reservedOnPaidOrders).toEqual([order.id]);
    await expect(
      service.execute(BUYER, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000000210',
        aggregateId: 'inventory:reconcile',
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'inventory.reconcile_paid',
        payload: {},
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });

    const reconciled = await service.execute(MARKETPLACE_SANDBOX_FINANCE, {
      version: 1,
      commandId: '00000000-0000-4000-8000-000000000211',
      aggregateId: 'inventory:reconcile',
      expectedRevision: 0,
      issuedAt: NOW.toISOString(),
      kind: 'inventory.reconcile_paid',
      payload: {},
    });
    expect(reconciled).toMatchObject({
      ok: true,
      result: { kind: 'inventory_reconcile', convertedOrderIds: [order.id], failedOrderIds: [] },
    });
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      reservedQuantity: 0,
      soldQuantity: 1,
      state: 'sold',
    });
    expect(repository.getOrder(order.id)).toMatchObject({ inventoryState: 'sold' });
    expect(repository.getEvents().filter((event) => event.kind === 'payment.confirmed')).toHaveLength(1);
    expect(repository.getEvents().some((event) => event.kind === 'inventory.reconciled')).toBe(true);
    expect(service.getInvariants().reservedOnPaidOrders).toEqual([]);
    expect(service.getMetrics()).toMatchObject({ orders: 1, paymentsConfirmed: 1, reservedOnPaidOrders: 0 });

    await expect(
      service.execute(MARKETPLACE_SANDBOX_FINANCE, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000000212',
        aggregateId: 'inventory:reconcile',
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'inventory.reconcile_paid',
        payload: {},
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'inventory_reconcile', convertedOrderIds: [], skippedOrderIds: [order.id] },
    });
  });

  it('repairs leftover reserved listing units when paid orders already look sold', async () => {
    const { repository, service } = createService();
    const order = await createPaidOrder(service);
    const listing = repository.getListing(AGGREGATE_ID);
    if (!listing) throw new Error('Expected registered listing');
    repository.putListing({
      ...listing,
      state: 'reserved',
      reservedQuantity: 1,
      soldQuantity: 0,
    });
    repository.putOrder({ ...order, inventoryState: 'sold' });

    await expect(
      service.execute(MARKETPLACE_SANDBOX_FINANCE, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000000213',
        aggregateId: 'inventory:reconcile',
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'inventory.reconcile_paid',
        payload: {},
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'inventory_reconcile', convertedOrderIds: [order.id], failedOrderIds: [] },
    });
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      reservedQuantity: 0,
      soldQuantity: 1,
      state: 'sold',
    });
  });

  it('rejects duplicate checkout lines, stale stock, self-purchase, and invalid payment transitions', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const duplicate = checkoutCommand();
    duplicate.payload.lines.push({ ...duplicate.payload.lines[0] });
    await expect(service.execute(BUYER, duplicate)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_COMMAND' },
    });
    await expect(service.execute(SELLER, checkoutCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });

    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') return;
    const payment = checkout.result.payments[0];
    await expect(service.execute(BUYER, paymentCommand(payment.id, 1, 'confirmed', 0, 1_003))).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_COMMAND' },
    });
    await expect(
      service.execute(OTHER_BUYER, paymentCommand(payment.id, 1, 'detected', 0, 1_004)),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('records one in-flight delivery exception without refunding or rewriting payment', async () => {
    const { service } = createService();
    const order = await createPaidOrder(service);
    await service.execute(
      SELLER,
      orderCommand('fulfillment.ship', order.id, 2, { carrier: 'Sandbox Post', trackingNumber: ' track-123 ' }, 1_240),
    );

    const recorded = await service.execute(
      BUYER,
      orderCommand(
        'fulfillment.record_exception',
        order.id,
        3,
        { code: 'delayed', notes: 'Sandbox Post scan stalled in New York.' },
        1_241,
      ),
    );
    expect(recorded).toMatchObject({
      ok: true,
      result: {
        kind: 'order',
        order: {
          state: 'shipped',
          shipment: {
            trackingNumber: 'TRACK-123',
            exception: { code: 'delayed', notes: 'Sandbox Post scan stalled in New York.', actorPubky: BUYER },
          },
        },
      },
    });
    expect(service.getNotifications(SELLER).map(({ type }) => type)).toContain('delivery_exception');
    await expect(
      service.execute(
        SELLER,
        orderCommand(
          'fulfillment.record_exception',
          order.id,
          4,
          { code: 'lost', notes: 'Second exception must fail closed.' },
          1_242,
        ),
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    await expect(
      service.execute(
        OTHER_BUYER,
        orderCommand('fulfillment.record_exception', order.id, 4, { code: 'lost', notes: 'Unrelated actor.' }, 1_243),
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('ships, confirms delivery, and allows one review per participant', async () => {
    const { service } = createService();
    const order = await createPaidOrder(service);

    await expect(
      service.execute(
        SELLER,
        orderCommand('fulfillment.ship', order.id, 2, { carrier: 'Sandbox Post', trackingNumber: 'TRACK-123' }, 1_201),
      ),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'shipped', revision: 3 } } });
    await expect(
      service.execute(BUYER, orderCommand('fulfillment.confirm_delivery', order.id, 3, {}, 1_202)),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'delivered', revision: 4 } } });
    await expect(
      service.execute(
        BUYER,
        orderCommand('review.create', order.id, 4, { rating: 5, text: 'Accurate and fast.' }, 1_203),
      ),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'review', order: { state: 'completed', reviews: [{ rating: 5 }] } },
    });
    await expect(
      service.execute(SELLER, orderCommand('review.create', order.id, 5, { rating: 5, text: 'Great buyer.' }, 1_204)),
    ).resolves.toMatchObject({ ok: true, result: { order: { revision: 6, reviews: expect.any(Array) } } });
    await expect(
      service.execute(BUYER, orderCommand('review.create', order.id, 6, { rating: 4, text: 'Duplicate.' }, 1_205)),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });

  it('runs return approval, receipt, and externally verified refund without claiming custody', async () => {
    const { service } = createService();
    const order = await createPaidOrder(service);
    await service.execute(
      SELLER,
      orderCommand('fulfillment.ship', order.id, 2, { carrier: 'Sandbox Post', trackingNumber: 'TRACK-RETURN' }, 1_210),
    );
    await service.execute(BUYER, orderCommand('fulfillment.confirm_delivery', order.id, 3, {}, 1_211));

    await expect(
      service.execute(
        BUYER,
        orderCommand(
          'return.request',
          order.id,
          4,
          { reason: 'Item differs from description', requestedAmountMinor: order.total.amountMinor },
          1_212,
        ),
      ),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'return_requested', revision: 5 } } });
    await service.execute(SELLER, orderCommand('return.approve', order.id, 5, {}, 1_213));
    await expect(
      service.execute(
        BUYER,
        orderCommand('return.ship', order.id, 6, { carrier: 'Sandbox Returns', trackingNumber: 'RET-55' }, 1_214),
      ),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'return_in_transit' } } });
    await service.execute(SELLER, orderCommand('return.receive', order.id, 7, {}, 1_215));
    await expect(
      service.execute(
        SELLER,
        orderCommand('return.inspect', order.id, 8, { outcome: 'pass', notes: 'Item matches listing.' }, 1_216),
      ),
    ).resolves.toMatchObject({
      ok: true,
      result: { order: { state: 'return_inspection', returnRequest: { inspection: { outcome: 'pass' } } } },
    });
    const refunded = await service.execute(
      SELLER,
      orderCommand(
        'refund.record_external',
        order.id,
        9,
        { amountMinor: order.total.amountMinor, transactionId: 'bitcoin-tx-evidence-123' },
        1_217,
      ),
    );

    expect(refunded).toMatchObject({
      ok: true,
      result: {
        order: {
          state: 'refunded_external',
          externalRefund: { amountMinor: order.total.amountMinor, transactionId: 'bitcoin-tx-evidence-123' },
        },
      },
    });
  });

  it('cancels unpaid checkout immediately and releases reserved inventory once', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') return;
    const order = checkout.result.orders[0];

    await expect(
      service.execute(BUYER, orderCommand('order.cancel_request', order.id, 1, { reason: 'Changed mind' }, 1_220)),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'cancelled', revision: 2 } } });
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      state: 'available',
      availableQuantity: 1,
      reservedQuantity: 0,
    });
  });

  it('opens participant disputes and restricts resolution to the sandbox moderator', async () => {
    const { service } = createService();
    const order = await createPaidOrder(service);
    await service.execute(
      BUYER,
      orderCommand(
        'dispute.open',
        order.id,
        2,
        { reason: 'Seller stopped responding', requestedRemedy: 'refund' },
        1_230,
      ),
    );
    await expect(
      service.execute(
        SELLER,
        orderCommand(
          'dispute.resolve',
          order.id,
          3,
          { resolution: 'seller_favor', rationale: 'Self-resolution attempt' },
          1_231,
        ),
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    await expect(
      service.execute(
        MARKETPLACE_SANDBOX_MODERATOR,
        orderCommand(
          'dispute.resolve',
          order.id,
          3,
          { resolution: 'buyer_refund', rationale: 'Evidence supports the buyer.' },
          1_232,
        ),
      ),
    ).resolves.toMatchObject({
      ok: true,
      result: { order: { state: 'disputed', dispute: { state: 'resolved', resolution: 'buyer_refund' } } },
    });
  });

  it('records structured trust reports without exposing them to ordinary users', async () => {
    const { service } = createService();
    const commandId = '00000000-0000-4000-8000-000000001240';
    await expect(
      service.execute(BUYER, {
        version: 1,
        commandId,
        aggregateId: `report:${commandId}`,
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'trust.report',
        payload: {
          targetType: 'listing',
          targetId: AGGREGATE_ID,
          reason: 'counterfeit',
          details: 'Brand markings appear inconsistent.',
        },
      }),
    ).resolves.toMatchObject({ ok: true, result: { kind: 'report', report: { state: 'open' } } });
    expect(service.getReports(BUYER)).toEqual([]);
    expect(service.getReports(MARKETPLACE_SANDBOX_MODERATOR)).toHaveLength(1);
  });

  it('closes an active auction immediately when a buyer uses buy-now', async () => {
    const { service } = createService();
    const register = registerAuctionCommand();
    const payload = register.payload as typeof register.payload & {
      auctionTerms: {
        startsAt: string;
        endsAt: string;
        minimumIncrement: { amountMinor: number; currency: string; exponent: number };
        reservePrice: { amountMinor: number; currency: string; exponent: number };
        antiSnipingWindowSeconds: number;
        antiSnipingExtensionSeconds: number;
        buyNowPrice?: { amountMinor: number; currency: string; exponent: number };
      };
    };
    payload.auctionTerms.buyNowPrice = { amountMinor: 20_000, currency: 'USD', exponent: 2 };
    await service.execute(SELLER, { ...register, payload });

    await expect(
      service.execute(BUYER, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001300',
        aggregateId: AGGREGATE_ID,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'auction.buy_now',
        payload: {},
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: {
        kind: 'auction_result',
        outcome: 'sold',
        winnerPubky: BUYER,
        listing: { state: 'reserved', auction: { status: 'sold', currentPrice: { amountMinor: 20_000 } } },
      },
    });
  });

  it('lets a seller send a private offer to a watcher and posts a balanced checkout ledger', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await expect(
      service.execute(SELLER, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001301',
        aggregateId: AGGREGATE_ID,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'offer.create_private',
        payload: {
          recipientPubky: BUYER,
          amount: { amountMinor: 9_000, currency: 'USD', exponent: 2 },
          quantity: 1,
          expiresInSeconds: 3_600,
          message: 'Private price for you.',
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'offer', offer: { buyerPubky: BUYER, offeredBy: SELLER, state: 'pending' } },
    });

    const checkout = await service.execute(BUYER, checkoutCommand());
    expect(checkout).toMatchObject({ ok: true });
    const entries = service.getLedger(BUYER);
    const debit = entries
      .filter(({ direction }) => direction === 'debit')
      .reduce((total, entry) => total + entry.amountMinor, 0);
    const credit = entries
      .filter(({ direction }) => direction === 'credit')
      .reduce((total, entry) => total + entry.amountMinor, 0);
    expect(debit).toBe(credit);
    expect(debit).toBeGreaterThan(0);
  });

  it('applies a seller coupon, then allows review edit, reply, payout, and moderation restrict', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await expect(
      service.execute(SELLER, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001302',
        aggregateId: `promotion:${SELLER}_SAVE10`,
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'promotion.create',
        payload: { code: 'SAVE10', percentOff: 10, usageLimit: 5, expiresInSeconds: 86_400 },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'promotion', promotion: { code: 'SAVE10', percentOff: 10 } },
    });

    const checkout = {
      ...checkoutCommand(),
      payload: { ...checkoutCommand().payload, couponCode: 'SAVE10' },
    };
    checkout.commandId = '00000000-0000-4000-8000-000000001303';
    checkout.aggregateId = buildMarketplaceCheckoutAggregateId(checkout.commandId);
    const created = await service.execute(BUYER, checkout);
    expect(created).toMatchObject({
      ok: true,
      result: { orders: [{ discount: { amountMinor: 1_250 }, couponCode: 'SAVE10' }] },
    });
    if (!created.ok || created.result.kind !== 'checkout') return;
    const payment = created.result.payments[0];
    const order = created.result.orders[0];
    await service.execute(BUYER, paymentCommand(payment.id, 1, 'confirmed', 1, 1_304));
    await service.execute(
      SELLER,
      orderCommand('fulfillment.ship', order.id, 2, { carrier: 'Sandbox Post', trackingNumber: 'TRACK-PROMO' }, 1_305),
    );
    await service.execute(BUYER, orderCommand('fulfillment.confirm_delivery', order.id, 3, {}, 1_306));
    const reviewed = await service.execute(
      BUYER,
      orderCommand('review.create', order.id, 4, { rating: 4, text: 'Good item.' }, 1_307),
    );
    expect(reviewed).toMatchObject({ ok: true, result: { kind: 'review' } });
    if (!reviewed.ok || reviewed.result.kind !== 'review') return;
    await expect(
      service.execute(
        BUYER,
        orderCommand(
          'review.edit',
          order.id,
          5,
          { reviewId: reviewed.result.review.id, rating: 5, text: 'Even better after a day.' },
          1_308,
        ),
      ),
    ).resolves.toMatchObject({ ok: true, result: { review: { rating: 5, editedAt: NOW.toISOString() } } });
    await expect(
      service.execute(
        SELLER,
        orderCommand('review.reply', order.id, 6, { reviewId: reviewed.result.review.id, text: 'Thank you!' }, 1_309),
      ),
    ).resolves.toMatchObject({ ok: true, result: { review: { reply: 'Thank you!' } } });
    await expect(
      service.execute(SELLER, orderCommand('payout.release', order.id, 7, {}, 1_310)),
    ).resolves.toMatchObject({ ok: true, result: { order: { payoutState: 'released' } } });
    expect(service.getSellerStatement(SELLER).releasedMinor).toBeGreaterThan(0);

    const reportId = '00000000-0000-4000-8000-000000001311';
    await service.execute(BUYER, {
      version: 1,
      commandId: reportId,
      aggregateId: `report:${reportId}`,
      expectedRevision: 0,
      issuedAt: NOW.toISOString(),
      kind: 'trust.report',
      payload: { targetType: 'listing', targetId: AGGREGATE_ID, reason: 'scam', details: 'Suspicious wording.' },
    });
    await expect(
      service.execute(MARKETPLACE_SANDBOX_MODERATOR, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001312',
        aggregateId: `report:${reportId}`,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'trust.decide',
        payload: { reportId, decision: 'restrict_listing', notes: 'Hide from discovery pending review.' },
      }),
    ).resolves.toMatchObject({ ok: true, result: { report: { state: 'restricted' } } });
    expect(service.getRestrictedListingIds()).toContain(AGGREGATE_ID);
  });

  it('blocks a buyer from checkout and publishes seller reputation from reviews', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await expect(
      service.execute(SELLER, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001320',
        aggregateId: `blocked:${SELLER}`,
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'buyer.block',
        payload: { buyerPubky: BUYER },
      }),
    ).resolves.toMatchObject({ ok: true, result: { kind: 'blocked_buyer', blocked: true } });
    expect(service.getBlockedBuyers(SELLER)).toEqual([BUYER]);
    await expect(service.execute(BUYER, checkoutCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });

    await service.execute(SELLER, {
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001321',
      aggregateId: `blocked:${SELLER}`,
      expectedRevision: 0,
      issuedAt: NOW.toISOString(),
      kind: 'buyer.unblock',
      payload: { buyerPubky: BUYER },
    });
    const created = await service.execute(BUYER, checkoutCommand());
    expect(created).toMatchObject({ ok: true });
    if (!created.ok || created.result.kind !== 'checkout') return;
    const payment = created.result.payments[0];
    const order = created.result.orders[0];
    await service.execute(BUYER, paymentCommand(payment.id, 1, 'confirmed', 1, 1_322));
    await service.execute(
      SELLER,
      orderCommand('fulfillment.ship', order.id, 2, { carrier: 'Sandbox Post', trackingNumber: 'TRACK-REP' }, 1_323),
    );
    await service.execute(BUYER, orderCommand('fulfillment.confirm_delivery', order.id, 3, {}, 1_324));
    await service.execute(
      BUYER,
      orderCommand(
        'review.create',
        order.id,
        4,
        { rating: 5, text: 'Accurate and fast.', itemAccuracy: 5, shipping: 4, communication: 5 },
        1_325,
      ),
    );
    expect(service.getSellerReputation(SELLER)).toMatchObject({
      reviewCount: 1,
      averageRating: 5,
      salesCount: 1,
      itemAccuracy: 5,
      shipping: 4,
      communication: 5,
      responseTimeHours: null,
    });
  });

  it('marks pickup ready, offers a partial return, and assigns then reverses a report', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const created = await service.execute(BUYER, checkoutCommand());
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'checkout') return;
    const order = created.result.orders[0];
    const payment = created.result.payments[0];
    await service.execute(BUYER, paymentCommand(payment.id, 1, 'confirmed', 1, 1_400));
    await expect(
      service.execute(SELLER, orderCommand('fulfillment.ready_for_pickup', order.id, 2, {}, 1_401)),
    ).resolves.toMatchObject({ ok: true, result: { order: { state: 'ready_for_pickup' } } });
    await service.execute(BUYER, orderCommand('fulfillment.confirm_delivery', order.id, 3, {}, 1_402));
    await service.execute(
      BUYER,
      orderCommand('return.request', order.id, 4, { reason: 'Too large.', requestedAmountMinor: 12_500 }, 1_403),
    );
    await expect(
      service.execute(SELLER, orderCommand('return.offer_partial', order.id, 5, { offeredAmountMinor: 4_000 }, 1_404)),
    ).resolves.toMatchObject({
      ok: true,
      result: { order: { returnRequest: { state: 'partial_offered', offeredAmountMinor: 4_000 } } },
    });

    const reportId = '00000000-0000-4000-8000-000000001405';
    await service.execute(BUYER, {
      version: 1,
      commandId: reportId,
      aggregateId: `report:${reportId}`,
      expectedRevision: 0,
      issuedAt: NOW.toISOString(),
      kind: 'trust.report',
      payload: { targetType: 'review', targetId: reportId, reason: 'other', details: 'Review looks fake.' },
    });
    await expect(
      service.execute(MARKETPLACE_SANDBOX_MODERATOR, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001406',
        aggregateId: `report:${reportId}`,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'trust.assign',
        payload: { reportId, assigneePubky: MARKETPLACE_SANDBOX_MODERATOR },
      }),
    ).resolves.toMatchObject({ ok: true, result: { report: { assignedTo: MARKETPLACE_SANDBOX_MODERATOR } } });
    await expect(
      service.execute(MARKETPLACE_SANDBOX_MODERATOR, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001407',
        aggregateId: `report:${reportId}`,
        expectedRevision: 2,
        issuedAt: NOW.toISOString(),
        kind: 'trust.decide',
        payload: { reportId, decision: 'warn', notes: 'Warning recorded.' },
      }),
    ).resolves.toMatchObject({ ok: true, result: { report: { state: 'warned' } } });
    await expect(
      service.execute(MARKETPLACE_SANDBOX_MODERATOR, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001408',
        aggregateId: `report:${reportId}`,
        expectedRevision: 3,
        issuedAt: NOW.toISOString(),
        kind: 'trust.reverse',
        payload: { reportId, notes: 'Reopen after appeal.' },
      }),
    ).resolves.toMatchObject({ ok: true, result: { report: { state: 'open' } } });
    expect(service.getInvariants().unbalancedOrders).toEqual([]);
    expect(service.searchAdmin(MARKETPLACE_SANDBOX_MODERATOR, 'fake').reports).toHaveLength(1);
  });

  it('blocks a conversation without deleting history and rejects later sends', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    await service.execute(
      BUYER,
      messageCommand(BUYER, SELLER, 0, '00000000-0000-4000-8000-000000001500', 'Is this still available?'),
    );
    await expect(
      service.execute(BUYER, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001501',
        aggregateId: buildMarketplaceConversationAggregateId(SELLER, BUYER, 'boots_01'),
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'message.block',
        payload: { listingAggregateId: AGGREGATE_ID, peerPubky: SELLER },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: {
        kind: 'conversation',
        conversation: {
          blockedBy: [BUYER],
          messages: [
            { text: 'Is this still available?', kind: 'text' },
            { kind: 'system', text: 'Conversation blocked. Existing messages stay visible.' },
          ],
        },
      },
    });
    await expect(
      service.execute(BUYER, messageCommand(BUYER, SELLER, 2, '00000000-0000-4000-8000-000000001502', 'Still there?')),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('records append-only risk signals without changing order or listing state', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') throw new Error('Checkout fixture failed');
    const orderId = checkout.result.orders[0].id;
    const commandId = '00000000-0000-4000-8000-000000001510';
    await expect(
      service.execute(MARKETPLACE_SANDBOX_MODERATOR, {
        version: 1,
        commandId,
        aggregateId: `risk:${commandId}`,
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'trust.flag_risk',
        payload: {
          signalType: 'auction_manipulation',
          targetType: 'order',
          targetId: orderId,
          details: 'Bid pattern looks coordinated.',
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'risk_signal', signal: { signalType: 'auction_manipulation' } },
    });
    expect(service.getOrders(BUYER)[0].state).toBe('pending_payment');
    expect(service.getRiskSignals(BUYER)).toEqual([]);
    expect(service.getRiskSignals(MARKETPLACE_SANDBOX_MODERATOR)).toHaveLength(1);
    expect(service.searchAdmin(MARKETPLACE_SANDBOX_MODERATOR, 'coordinated').riskSignals).toHaveLength(1);
  });

  it('sends listing and offer cards and records offer system events', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const offer = await service.execute(BUYER, createOfferCommand());
    if (!offer.ok || offer.result.kind !== 'offer') throw new Error('Offer fixture failed');

    const conversationsAfterOffer = service.getParticipantConversations(BUYER);
    expect(conversationsAfterOffer[0]?.messages.at(-1)).toMatchObject({
      kind: 'system',
      card: { type: 'offer', offerId: offer.result.offer.id },
    });

    await expect(
      service.execute(BUYER, {
        ...messageCommand(BUYER, SELLER, 1, '00000000-0000-4000-8000-000000001520', ''),
        payload: {
          listingAggregateId: AGGREGATE_ID,
          recipientPubky: SELLER,
          text: '',
          kind: 'listing_card',
          card: { type: 'listing', listingAggregateId: AGGREGATE_ID },
          attachmentIds: [],
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { message: { kind: 'listing_card', card: { type: 'listing', listingTitle: 'Marketplace item' } } },
    });

    await expect(
      service.execute(BUYER, {
        ...messageCommand(BUYER, SELLER, 2, '00000000-0000-4000-8000-000000001521', ''),
        payload: {
          listingAggregateId: AGGREGATE_ID,
          recipientPubky: SELLER,
          text: '',
          kind: 'offer_card',
          card: { type: 'offer', listingAggregateId: AGGREGATE_ID, offerId: offer.result.offer.id },
          attachmentIds: [],
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { message: { kind: 'offer_card', card: { type: 'offer', offerAmountMinor: 10_000 } } },
    });
  });

  it('issues a sandbox digital credential and audits access hashes', async () => {
    const { service } = createService();
    await service.execute(SELLER, {
      ...registerCommand(),
      payload: {
        ...registerCommand().payload,
        fulfillment: 'digital',
        digitalLock: {
          policyUri: `pubky://${SELLER}/pub/locks.app/boots_01.json`,
          criterionId: 'criterion-1',
          resourceHash: 'a'.repeat(64),
          minimumConfirmations: 1,
        },
      },
    });
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') throw new Error('Checkout fixture failed');
    const order = checkout.result.orders[0];
    const payment = checkout.result.payments[0];
    expect(order).toMatchObject({ fulfillment: 'digital', shipping: { amountMinor: 0 } });

    const confirmed = await service.execute(BUYER, paymentCommand(payment.id, 1, 'confirmed', 1, 1_530));
    if (!confirmed.ok || confirmed.result.kind !== 'payment') throw new Error('Payment fixture failed');
    expect(confirmed.result.order.digitalDelivery).toMatchObject({
      resourceHash: 'a'.repeat(64),
      accessCount: 0,
      integrityOk: true,
    });

    await expect(
      service.execute(
        BUYER,
        orderCommand(
          'fulfillment.record_access',
          confirmed.result.order.id,
          confirmed.result.order.revision,
          { contentHash: 'b'.repeat(64) },
          1_531,
        ),
      ),
    ).resolves.toMatchObject({
      ok: true,
      result: { order: { state: 'delivered', digitalDelivery: { integrityOk: false, accessCount: 1 } } },
    });
  });

  it('stores the labeled sandbox payment endpoint on checkout', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());
    const command = checkoutCommand();
    await expect(
      service.execute(BUYER, {
        ...command,
        payload: { ...command.payload, paymentEndpoint: 'sandbox_labeled_invoice' },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'checkout', payments: [{ endpointId: 'sandbox_labeled_invoice', adapter: 'sandbox' }] },
    });
  });

  it('requires a watch before a buyer can offer on a watcher-only listing', async () => {
    const { service } = createService();
    await service.execute(SELLER, {
      ...registerCommand(),
      payload: {
        ...registerCommand().payload,
        saleFormat: 'offer',
        offersOpenTo: 'watchers',
      },
    });

    await expect(service.execute(BUYER, createOfferCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Only watchers can make an offer on this listing.' },
    });

    await expect(
      service.execute(BUYER, {
        version: 1,
        commandId: '00000000-0000-4000-8002-000000000001',
        aggregateId: AGGREGATE_ID,
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'listing.watch',
        payload: {},
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'watch', watching: true, watcherPubky: BUYER },
    });

    await expect(service.execute(BUYER, createOfferCommand())).resolves.toMatchObject({
      ok: true,
      result: { kind: 'offer', offer: { state: 'pending', buyerPubky: BUYER } },
    });

    await expect(service.execute(BUYER, checkoutCommand())).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
  });

  it('rejects seller self-watches and flags increment-only bids that never take the lead', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerAuctionCommand());
    await expect(
      service.execute(SELLER, {
        version: 1,
        commandId: '00000000-0000-4000-8002-000000000002',
        aggregateId: AGGREGATE_ID,
        expectedRevision: 0,
        issuedAt: NOW.toISOString(),
        kind: 'listing.watch',
        payload: {},
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });

    await expect(service.execute(BUYER, placeBidCommand(1, 20_000, 1))).resolves.toMatchObject({
      ok: true,
      result: { listing: { auction: { leaderPubky: BUYER, bidCount: 1 } } },
    });
    expect(service.getRiskSignals(MARKETPLACE_SANDBOX_MODERATOR)).toEqual([]);

    await expect(service.execute(OTHER_BUYER, placeBidCommand(2, 5_500, 2))).resolves.toMatchObject({
      ok: true,
      result: { listing: { auction: { leaderPubky: BUYER, bidCount: 2 } } },
    });
    expect(service.getRiskSignals(MARKETPLACE_SANDBOX_MODERATOR)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalType: 'auction_manipulation',
          targetType: 'auction',
          targetId: AGGREGATE_ID,
        }),
      ]),
    );
    expect(service.getListingProjection(AGGREGATE_ID)?.auction?.leaderPubky).toBe(BUYER);
  });

  it('reconstructs public bid history without leaking proxy maximums', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerAuctionCommand());
    await service.execute(BUYER, placeBidCommand(1, 20_000, 1));
    await service.execute(OTHER_BUYER, placeBidCommand(2, 5_500, 2));

    const projection = service.getListingProjection(AGGREGATE_ID);
    expect(projection?.visibleBidHistory).toEqual([
      expect.objectContaining({
        sequence: 1,
        bidderPubky: BUYER,
        visiblePrice: { amountMinor: 4_500, currency: 'USD', exponent: 2 },
      }),
      expect.objectContaining({
        sequence: 2,
        bidderPubky: OTHER_BUYER,
        visiblePrice: { amountMinor: 6_000, currency: 'USD', exponent: 2 },
      }),
    ]);
    expect(JSON.stringify(projection)).not.toContain('maximumAmount');
    expect(JSON.stringify(projection?.visibleBidHistory)).not.toContain('20000');
    expect(projection?.auction?.minimumNextBid).toEqual({ amountMinor: 6_001, currency: 'USD', exponent: 2 });
  });

  it('auto-accepts buyer offers at or above the seller threshold', async () => {
    const { service } = createService();
    await service.execute(SELLER, {
      ...registerCommand(),
      payload: {
        ...registerCommand().payload,
        autoAcceptAmount: { amountMinor: 10_000, currency: 'USD', exponent: 2 },
      },
    });

    await expect(service.execute(BUYER, createOfferCommand())).resolves.toMatchObject({
      ok: true,
      result: {
        kind: 'accepted_offer',
        offer: { state: 'accepted', amount: { amountMinor: 10_000 } },
        listing: { reservedQuantity: 1, availableQuantity: 0 },
      },
    });
  });

  it('leaves offers below the auto-accept threshold pending', async () => {
    const { service } = createService();
    await service.execute(SELLER, {
      ...registerCommand(),
      payload: {
        ...registerCommand().payload,
        autoAcceptAmount: { amountMinor: 11_000, currency: 'USD', exponent: 2 },
      },
    });

    await expect(service.execute(BUYER, createOfferCommand())).resolves.toMatchObject({
      ok: true,
      result: { kind: 'offer', offer: { state: 'pending', amount: { amountMinor: 10_000 } } },
    });
  });

  it('rejects auction auto-accept, oversize titles, and oversize offer messages', async () => {
    const { service } = createService();

    await expect(
      service.execute(SELLER, {
        ...registerAuctionCommand(),
        payload: {
          ...registerAuctionCommand().payload,
          autoAcceptAmount: { amountMinor: 4_000, currency: 'USD', exponent: 2 },
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });

    await expect(
      service.execute(SELLER, {
        ...registerCommand(),
        payload: { ...registerCommand().payload, title: 'x'.repeat(81) },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });

    await service.execute(SELLER, registerCommand());
    await expect(
      service.execute(BUYER, {
        ...createOfferCommand(),
        payload: { ...createOfferCommand().payload, message: 'x'.repeat(501) },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
  });

  it('stores script-like offer text as data and blocks third-party accept plus bid replay mutation', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerCommand());

    await expect(
      service.execute(BUYER, {
        ...createOfferCommand(),
        payload: { ...createOfferCommand().payload, message: '<script>alert(1)</script>' },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { offer: { message: '<script>alert(1)</script>', state: 'pending' } },
    });
    expect(service.getOffers(BUYER)[0]?.message).toBe('<script>alert(1)</script>');

    await expect(
      service.execute(OTHER_BUYER, offerAction('offer.accept', 1, '00000000-0000-4000-8000-000000000512')),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('replays identical bids and rejects the same command id with different input', async () => {
    const { service } = createService();
    await service.execute(SELLER, registerAuctionCommand());
    const firstBid = await service.execute(BUYER, placeBidCommand(1, 20_000, 1));
    await expect(service.execute(BUYER, placeBidCommand(1, 20_000, 1))).resolves.toEqual(firstBid);
    await expect(
      service.execute(BUYER, {
        ...placeBidCommand(1, 21_000, 1),
        commandId: placeBidCommand(1, 20_000, 1).commandId,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
  });

  it('separates support, risk, finance, and moderator powers', async () => {
    const { service } = createService();
    const order = await createPaidOrder(service);
    const note = await service.execute(MARKETPLACE_SANDBOX_SUPPORT, {
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001610',
      aggregateId: `order:${order.id}`,
      expectedRevision: order.revision,
      issuedAt: NOW.toISOString(),
      kind: 'support.note',
      payload: { orderId: order.id, text: 'Buyer asked about pickup hours.' },
    });
    expect(note).toMatchObject({
      ok: true,
      result: { kind: 'order', order: { supportNotes: [{ text: 'Buyer asked about pickup hours.' }] } },
    });
    const supportOrders = service.getOrders(MARKETPLACE_SANDBOX_SUPPORT);
    expect(supportOrders).toHaveLength(1);
    expect(supportOrders[0]?.deliveryAddress.line1).toBe(MARKETPLACE_REDACTED);
    expect(JSON.stringify(supportOrders)).not.toContain('1 Market Street');
    expect(service.getReports(MARKETPLACE_SANDBOX_SUPPORT)).toEqual([]);
    expect(service.getLedger(MARKETPLACE_SANDBOX_SUPPORT)).toEqual([]);

    await expect(
      service.execute(MARKETPLACE_SANDBOX_SUPPORT, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001611',
        aggregateId: `order:${order.id}`,
        expectedRevision: order.revision + 1,
        issuedAt: NOW.toISOString(),
        kind: 'refund.record_external',
        payload: { orderId: order.id, amountMinor: 1_000, transactionId: 'ext-refund-1' },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    await expect(
      service.execute(MARKETPLACE_SANDBOX_FINANCE, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001612',
        aggregateId: `report:${order.id}`,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'trust.decide',
        payload: {
          reportId: '00000000-0000-4000-8000-000000001699',
          decision: 'ban',
          notes: 'Finance cannot moderate.',
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });

    const hold = await service.execute(MARKETPLACE_SANDBOX_RISK, {
      version: 1,
      commandId: '00000000-0000-4000-8000-000000001613',
      aggregateId: `enforcement:${BUYER}`,
      expectedRevision: 0,
      issuedAt: NOW.toISOString(),
      kind: 'risk.hold',
      payload: { subjectPubky: BUYER, notes: 'Payment pattern needs review.' },
    });
    expect(hold).toMatchObject({
      ok: true,
      result: { kind: 'enforcement', enforcement: { subjectPubky: BUYER, actions: ['transaction_hold'] } },
    });
    expect(service.getEnforcements(MARKETPLACE_SANDBOX_RISK)).toHaveLength(1);
    expect(service.getEnforcements(MARKETPLACE_SANDBOX_FINANCE)).toEqual([]);
    await expect(
      service.execute(MARKETPLACE_SANDBOX_MODERATOR, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001614',
        aggregateId: `enforcement:${BUYER}`,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'risk.release',
        payload: { subjectPubky: BUYER, notes: 'Moderator cannot release holds.' },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    await expect(
      service.execute(MARKETPLACE_SANDBOX_RISK, {
        version: 1,
        commandId: '00000000-0000-4000-8000-000000001615',
        aggregateId: `enforcement:${BUYER}`,
        expectedRevision: 1,
        issuedAt: NOW.toISOString(),
        kind: 'risk.release',
        payload: { subjectPubky: BUYER, notes: 'Reviewed and released.' },
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: 'enforcement', enforcement: { actions: [] } },
    });

    expect(service.getLedger(MARKETPLACE_SANDBOX_FINANCE).length).toBeGreaterThan(0);
    expect(service.searchAdmin(MARKETPLACE_SANDBOX_SUPPORT, order.id).orders).toHaveLength(1);
    expect(service.searchAdmin(MARKETPLACE_SANDBOX_SUPPORT, order.id).reports).toEqual([]);
    expect(service.searchAdmin(MARKETPLACE_SANDBOX_FINANCE, order.id).reports).toEqual([]);
  });

  it('allows exactly one of 100 concurrent checkouts to take the last unit', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) => {
        const command = checkoutCommand();
        return service.execute(concurrentBuyer(index), {
          ...command,
          commandId: concurrentCommandId(2_000 + index),
          aggregateId: buildMarketplaceCheckoutAggregateId(concurrentCommandId(2_000 + index)),
        });
      }),
    );
    const accepted = results.filter(({ ok }) => ok);
    const rejected = results.filter(({ ok }) => !ok);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(99);
    expect(
      rejected.every(
        (result) =>
          !result.ok &&
          (result.error.code === 'REVISION_CONFLICT' ||
            result.error.code === 'INSUFFICIENT_INVENTORY' ||
            result.error.code === 'INVALID_STATE'),
      ),
    ).toBe(true);
    expect(repository.getListing(AGGREGATE_ID)).toMatchObject({
      availableQuantity: 0,
      reservedQuantity: 1,
      serverRevision: 2,
    });
  });

  it('allows exactly one of 100 concurrent last bids to advance an auction', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerAuctionCommand());
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        service.execute(concurrentBuyer(index), placeBidCommand(100 + index, 10_000 + index * 100, 1)),
      ),
    );
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(results.filter(({ ok }) => !ok)).toHaveLength(99);
    expect(repository.getListing(AGGREGATE_ID)?.auction?.bidCount).toBe(1);
    expect(repository.getListing(AGGREGATE_ID)?.serverRevision).toBe(2);
  });

  it('closes an ended auction exactly once under 100 concurrent close commands', async () => {
    let now = new Date(NOW);
    const repository = new InMemoryMarketplaceRepository();
    const service = new MarketplaceTransactionService(repository, () => new Date(now));
    await service.execute(SELLER, registerAuctionCommand());
    await service.execute(BUYER, placeBidCommand(30, 10_000, 1));
    await service.execute(OTHER_BUYER, placeBidCommand(31, 8_000, 2));
    now = new Date(NOW.getTime() + 11 * 60 * 1_000);
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) => service.execute(SELLER, closeAuctionCommand(3, 3_000 + index))),
    );
    const accepted = results.filter(({ ok }) => ok);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      ok: true,
      result: { kind: 'auction_result', outcome: 'sold', winnerPubky: BUYER },
    });
    expect(results.filter(({ ok }) => !ok)).toHaveLength(99);
    expect(repository.getListing(AGGREGATE_ID)?.auction?.status).toBe('sold');
    expect(repository.getEvents().filter((event) => event.kind.startsWith('auction.closed_'))).toHaveLength(1);
  });

  it('confirms a sandbox payment at most once under 100 concurrent advances', async () => {
    const { repository, service } = createService();
    await service.execute(SELLER, registerCommand());
    const checkout = await service.execute(BUYER, checkoutCommand());
    if (!checkout.ok || checkout.result.kind !== 'checkout') throw new Error('Checkout fixture failed');
    const paymentId = checkout.result.payments[0].id;
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        service.execute(BUYER, paymentCommand(paymentId, 1, 'confirmed', 1, 4_000 + index)),
      ),
    );
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(results.filter(({ ok }) => !ok)).toHaveLength(99);
    expect(repository.getPayment(paymentId)?.state).toBe('confirmed');
    expect(repository.getEvents().filter((event) => event.kind === 'payment.confirmed')).toHaveLength(1);
    expect(service.getOrders(BUYER)[0]?.state).toBe('paid');
  });
});

function concurrentBuyer(index: number): string {
  const alphabet = 'ybndrfg8ejkmcpqxot1uwisza345h769';
  return `t${alphabet[index % 32]}${alphabet[Math.floor(index / 32) % 32]}${'u'.repeat(49)}`;
}

function concurrentCommandId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}
