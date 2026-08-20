import { getCommerceAdapterMode } from '@/config/commerce';
import {
  type CommerceListingRecord,
  commerceListingSalePrice,
  type CommerceShopRecord,
} from '@/libs/commerce/marketplace-records';
import {
  sandboxAuctionSeedPlan,
  sandboxListingAutoAcceptAmount,
  sandboxListingCatalogQuantity,
  sandboxListingNeedsReregister,
  sandboxListingShippingQuoteMinor,
} from '@/libs/commerce/sandbox-bootstrap';
import { createCommerceSandboxCatalog } from '@/libs/commerce/sandbox-catalog';
import { buildMarketplaceListingAggregateId, type MarketplaceCommand } from '@/libs/commerce/transaction-commands';
import type { CommerceJsonValue } from '@/libs/commerce/transaction-contracts';
import type { CommerceSyncJobModelSchema } from '@/models/commerce/commerce.schema';
import { CommerceRecordNormalizer } from '@/pipes/commerce/commerce.normalizer';
import { CommerceHomeserverService } from '@/services/homeserver/commerce/commerce';
import { LocalCommerceService } from '@/services/local/commerce/commerce';
import { LocksGatewayService } from '@/services/locks/locks';
import { MarketplaceGatewayService } from '@/services/marketplace/marketplace';

export class CommerceApplication {
  private static sandboxCatalogInit: Promise<boolean> | null = null;

  private constructor() {}

  static async getShop(ownerPubky: string) {
    return await LocalCommerceService.getShop(ownerPubky);
  }

  static async getAllShops() {
    return await LocalCommerceService.getAllShops();
  }

  static async fetchShop(ownerPubky: string): Promise<CommerceShopRecord> {
    const url = CommerceRecordNormalizer.shopUri(ownerPubky);
    return CommerceRecordNormalizer.shop(await CommerceHomeserverService.fetchJson(url));
  }

  static async getOrFetchShop(ownerPubky: string): Promise<CommerceShopRecord> {
    const local = await LocalCommerceService.getShop(ownerPubky);
    if (local) return local.record;

    const record = await this.fetchShop(ownerPubky);
    await LocalCommerceService.upsertShop(record, 'synced');
    return record;
  }

  static async getListing(compositeListingId: string) {
    return await LocalCommerceService.getListing(compositeListingId);
  }

  static async getListingsBySeller(sellerPubky: string) {
    return await LocalCommerceService.getListingsBySeller(sellerPubky);
  }

  static async getListingsByCategory(categoryId: string) {
    return await LocalCommerceService.getListingsByCategory(categoryId);
  }

  static async getAllListings() {
    return await LocalCommerceService.getAllListings();
  }

  static async getListingDrafts(ownerPubky: string) {
    return await LocalCommerceService.getDraftsByOwner(ownerPubky);
  }

  static async commitUpdateListingDraft(ownerPubky: string, listingId: string, form: CommerceJsonValue): Promise<void> {
    await LocalCommerceService.upsertDraft({
      ownerId: ownerPubky,
      listingId,
      data: { ownerPubky, listingId, form },
      now: Date.now(),
    });
  }

  static async commitDeleteListingDraft(ownerPubky: string, listingId: string): Promise<void> {
    await LocalCommerceService.deleteDraft(`${ownerPubky}:${listingId}`);
  }

  static async initializeSandboxCatalog(): Promise<boolean> {
    if (getCommerceAdapterMode() !== 'sandbox') return false;
    this.sandboxCatalogInit ??= this.initializeSandboxCatalogOnce().finally(() => {
      this.sandboxCatalogInit = null;
    });
    return this.sandboxCatalogInit;
  }

  private static async initializeSandboxCatalogOnce(): Promise<boolean> {
    const catalog = createCommerceSandboxCatalog();
    const seeded = await LocalCommerceService.seedSandboxCatalog(catalog);
    await Promise.allSettled(catalog.listings.map((listing) => this.registerSandboxListing(listing)));
    return seeded;
  }

  static async executeMarketplaceCommand(actorPubky: string, command: MarketplaceCommand) {
    return await MarketplaceGatewayService.execute(actorPubky, command);
  }

  static async getMarketplaceListingProjection(aggregateId: string) {
    return await MarketplaceGatewayService.getListing(aggregateId);
  }

  static async getMarketplaceConversations(actorPubky: string) {
    return await MarketplaceGatewayService.getConversations(actorPubky);
  }

  static async getMarketplaceOffers(actorPubky: string) {
    return await MarketplaceGatewayService.getOffers(actorPubky);
  }

  static async getMarketplaceNotifications(actorPubky: string) {
    return await MarketplaceGatewayService.getNotifications(actorPubky);
  }

  static async getMarketplaceNotificationPreferences(actorPubky: string) {
    return await MarketplaceGatewayService.getNotificationPreferences(actorPubky);
  }

  static async getMarketplaceOrders(actorPubky: string) {
    return await MarketplaceGatewayService.getOrders(actorPubky);
  }

  static async getMarketplacePayment(actorPubky: string, paymentId: string) {
    return await MarketplaceGatewayService.getPayment(actorPubky, paymentId);
  }

  static async getMarketplaceReceipt(actorPubky: string, receiptId: string) {
    return await MarketplaceGatewayService.getReceipt(actorPubky, receiptId);
  }

  static async getMarketplaceReports(actorPubky: string) {
    return await MarketplaceGatewayService.getReports(actorPubky);
  }

  static async getRestrictedListingIds() {
    return await MarketplaceGatewayService.getRestrictedListingIds();
  }

  static async getMarketplaceLedger(actorPubky: string, orderId?: string) {
    return await MarketplaceGatewayService.getLedger(actorPubky, orderId);
  }

  static async getMarketplacePromotions(actorPubky: string) {
    return await MarketplaceGatewayService.getPromotions(actorPubky);
  }

  static async getMarketplaceStatement(actorPubky: string) {
    return await MarketplaceGatewayService.getStatement(actorPubky);
  }

  static async getMarketplaceAnalytics(actorPubky: string) {
    return await MarketplaceGatewayService.getAnalytics(actorPubky);
  }

  static async recordMarketplaceListingView(actorPubky: string, sellerPubky: string, listingId: string) {
    try {
      await MarketplaceGatewayService.execute(actorPubky, {
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: buildMarketplaceListingAggregateId(sellerPubky, listingId),
        expectedRevision: 0,
        issuedAt: new Date().toISOString(),
        kind: 'listing.view',
        payload: {},
      });
    } catch {
      // Listing views are best-effort telemetry and must not block the PDP.
    }
  }

  static async getBlockedBuyers(actorPubky: string) {
    return await MarketplaceGatewayService.getBlockedBuyers(actorPubky);
  }

  static async getSellerReputation(sellerPubky: string) {
    return await MarketplaceGatewayService.getSellerReputation(sellerPubky);
  }

  static async getMarketplaceInvariants(actorPubky: string) {
    return await MarketplaceGatewayService.getInvariants(actorPubky);
  }

  static async getMarketplaceRiskSignals(actorPubky: string) {
    return await MarketplaceGatewayService.getRiskSignals(actorPubky);
  }

  static async getMarketplaceEnforcements(actorPubky: string) {
    return await MarketplaceGatewayService.getEnforcements(actorPubky);
  }

  static async searchMarketplaceAdmin(actorPubky: string, query: string) {
    return await MarketplaceGatewayService.searchAdmin(actorPubky, query);
  }

  static async exportMarketplaceAccount(actorPubky: string) {
    const [server, local] = await Promise.all([
      MarketplaceGatewayService.exportAccount(actorPubky).catch(() => null),
      LocalCommerceService.exportAccountLocal(actorPubky),
    ]);
    return { exportedAt: new Date().toISOString(), ownerPubky: actorPubky, server, local };
  }

  static async deleteMarketplaceLocalData(actorPubky: string) {
    await LocalCommerceService.deleteAccountLocal(actorPubky);
  }

  static async getSavedSearches(ownerPubky: string) {
    return await LocalCommerceService.getSavedSearches(ownerPubky);
  }

  static async commitUpsertSavedSearch(
    ownerPubky: string,
    search: { name: string; query: string; categoryId: string | null; saleFormat: string },
  ): Promise<void> {
    await LocalCommerceService.upsertSavedSearch(
      ownerPubky,
      {
        name: search.name,
        query: search.query,
        category_id: search.categoryId,
        sale_format: search.saleFormat,
      },
      Date.now(),
    );
  }

  static async commitDeleteSavedSearch(ownerPubky: string, searchId: string): Promise<void> {
    await LocalCommerceService.deleteSavedSearch(ownerPubky, searchId);
  }

  static async uploadMarketplaceAttachment(actorPubky: string, recipientPubky: string, file: File) {
    return await MarketplaceGatewayService.uploadAttachment(actorPubky, recipientPubky, file);
  }

  static async fetchMarketplaceAttachment(actorPubky: string, attachmentId: string) {
    return await MarketplaceGatewayService.fetchAttachment(actorPubky, attachmentId);
  }

  static async generateLocksBundleId() {
    return await LocksGatewayService.generateBundleId();
  }

  static async submitLocksPaykitProof(params: {
    creatorPubky: string;
    readerPubky: string;
    bundleId: string;
    lockResource: string;
    criterionId: string;
  }) {
    return await LocksGatewayService.submitPaykitProof(params);
  }

  static async lookupLocksVerification(creatorPubky: string, bundleId: string) {
    return await LocksGatewayService.lookupVerification(creatorPubky, bundleId);
  }

  static async issueLocksAccessCredential(creatorPubky: string, bundleId: string) {
    return await LocksGatewayService.issueAccessCredential(creatorPubky, bundleId);
  }

  static async fetchLocksGuardedContent(relativePath: string, credential: string) {
    return await LocksGatewayService.fetchGuardedContent(relativePath, credential);
  }

  static getPaykitSetupUrl(returnTo: string, state: string) {
    return LocksGatewayService.buildPaykitSetupUrl(returnTo, state);
  }

  static async isFavorite(ownerPubky: string, listingId: string): Promise<boolean> {
    return await LocalCommerceService.isFavorite(ownerPubky, listingId);
  }

  static async getCartItems(ownerPubky: string) {
    return await LocalCommerceService.getCartItems(ownerPubky);
  }

  static async commitUpsertCartItem(
    ownerPubky: string,
    listingId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    await LocalCommerceService.upsertCartItem(ownerPubky, listingId, variantId, quantity, Date.now());
  }

  static async commitAddCartItem(
    ownerPubky: string,
    listingId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    await LocalCommerceService.addCartItem(ownerPubky, listingId, variantId, quantity, Date.now());
  }

  static async mergeGuestCart(fromOwnerPubky: string, toOwnerPubky: string): Promise<void> {
    await LocalCommerceService.mergeCart(fromOwnerPubky, toOwnerPubky, Date.now());
  }

  static async commitDeleteCartItem(ownerPubky: string, listingId: string, variantId: string): Promise<void> {
    await LocalCommerceService.deleteCartItem(ownerPubky, listingId, variantId);
  }

  static async commitClearCart(ownerPubky: string): Promise<void> {
    await LocalCommerceService.clearCart(ownerPubky);
  }

  static async getFavorites(ownerPubky: string) {
    return await LocalCommerceService.getFavorites(ownerPubky);
  }

  static async commitCreateFavorite(ownerPubky: string, listingId: string): Promise<void> {
    await LocalCommerceService.createFavorite(ownerPubky, listingId, Date.now());
    await this.syncListingWatch(ownerPubky, listingId, true);
  }

  static async commitDeleteFavorite(ownerPubky: string, listingId: string): Promise<void> {
    await LocalCommerceService.deleteFavorite(ownerPubky, listingId);
    await this.syncListingWatch(ownerPubky, listingId, false);
  }

  static async isShopFollowed(ownerPubky: string, sellerPubky: string): Promise<boolean> {
    return await LocalCommerceService.isShopFollowed(ownerPubky, sellerPubky);
  }

  static async getShopFollows(ownerPubky: string) {
    return await LocalCommerceService.getShopFollows(ownerPubky);
  }

  static async commitCreateShopFollow(ownerPubky: string, sellerPubky: string): Promise<void> {
    await LocalCommerceService.createShopFollow(ownerPubky, sellerPubky, Date.now());
  }

  static async commitDeleteShopFollow(ownerPubky: string, sellerPubky: string): Promise<void> {
    await LocalCommerceService.deleteShopFollow(ownerPubky, sellerPubky);
  }

  static async fetchListing(ownerPubky: string, listingId: string): Promise<CommerceListingRecord> {
    const url = CommerceRecordNormalizer.listingUri(ownerPubky, listingId);
    return CommerceRecordNormalizer.listing(await CommerceHomeserverService.fetchJson(url));
  }

  static async getOrFetchListing(ownerPubky: string, listingId: string): Promise<CommerceListingRecord> {
    const compositeListingId = `${ownerPubky}:${listingId}`;
    const local = await LocalCommerceService.getListing(compositeListingId);
    if (local) return local.record;

    const record = await this.fetchListing(ownerPubky, listingId);
    await LocalCommerceService.upsertListing(record, 'synced');
    return record;
  }

  static async commitUpsertShop(record: CommerceShopRecord): Promise<void> {
    const now = Date.now();
    const url = CommerceRecordNormalizer.shopUri(record.ownerPubky);
    const job = this.createSyncJob({
      ownerId: record.ownerPubky,
      entityType: 'shop',
      entityId: record.ownerPubky,
      operation: 'publish',
      payload: { url },
      now,
    });

    await LocalCommerceService.stageShopSync(record, job);
    await CommerceHomeserverService.putJson(url, { ...record });
    await LocalCommerceService.upsertShop(record, 'synced');
    await LocalCommerceService.completeSyncJob(job.id);
  }

  static async commitUpsertListing(record: CommerceListingRecord): Promise<void> {
    const now = Date.now();
    const url = CommerceRecordNormalizer.listingUri(record.ownerPubky, record.listingId);
    const publishJob = this.createSyncJob({
      ownerId: record.ownerPubky,
      entityType: 'listing',
      entityId: record.listingId,
      operation: 'publish',
      payload: { url },
      now,
    });

    await LocalCommerceService.stageListingSync(record, publishJob);
    await CommerceHomeserverService.putJson(url, { ...record });
    await LocalCommerceService.upsertListing(record, 'synced');
    await LocalCommerceService.completeSyncJob(publishJob.id);

    await LocalCommerceService.enqueueSyncJob(
      this.createSyncJob({
        ownerId: record.ownerPubky,
        entityType: 'listing',
        entityId: record.listingId,
        operation: 'register',
        payload: {
          url,
          listingRevision: record.revision,
        },
        now: Date.now(),
      }),
    );
    if (getCommerceAdapterMode() === 'sandbox') {
      try {
        await this.registerSandboxListing(record);
      } catch {
        // Registration job stays pending; the owner-signed listing is already local.
      }
    }
  }

  static async commitCreateMedia(ownerPubky: string, mediaId: string, bytes: Uint8Array): Promise<string> {
    const url = CommerceRecordNormalizer.mediaUri(ownerPubky, mediaId);
    await CommerceHomeserverService.putMedia(url, bytes);
    return url;
  }

  private static async registerSandboxListing(listing: CommerceListingRecord): Promise<void> {
    const aggregateId = buildMarketplaceListingAggregateId(listing.ownerPubky, listing.listingId);
    const existing = await MarketplaceGatewayService.getListing(aggregateId);
    if (sandboxListingNeedsReregister(existing, listing)) {
      const unitPrice = commerceListingSalePrice(listing.sale);
      const command = CommerceRecordNormalizer.marketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId,
        expectedRevision: existing?.serverRevision ?? 0,
        issuedAt: new Date().toISOString(),
        kind: 'listing.register',
        payload: {
          sellerPubky: listing.ownerPubky,
          listingId: listing.listingId,
          title: listing.title,
          listingRevision: existing?.listingRevision ? existing.listingRevision + 1 : listing.revision,
          contentHash: listing.media[0].contentHash,
          quantity: sandboxListingCatalogQuantity(listing),
          unitPrice,
          saleFormat: listing.sale.format,
          offersOpenTo: listing.sale.format === 'offer' ? listing.sale.offersOpenTo : undefined,
          autoAcceptAmount: sandboxListingAutoAcceptAmount(listing) ?? undefined,
          fulfillment: listing.fulfillmentMethods.includes('digital')
            ? 'digital'
            : listing.fulfillmentMethods.includes('physical')
              ? 'physical'
              : 'pickup',
          shippingQuoteMinor: sandboxListingShippingQuoteMinor(listing),
          digitalLock: listing.digitalLock,
          auctionTerms:
            listing.sale.format === 'auction'
              ? {
                  startsAt: listing.sale.startsAt,
                  endsAt: listing.sale.endsAt,
                  minimumIncrement: listing.sale.minimumIncrement,
                  reservePrice: listing.sale.reservePrice,
                  buyNowPrice: listing.sale.buyNowPrice,
                  antiSnipingWindowSeconds: listing.sale.antiSnipingWindowSeconds,
                  antiSnipingExtensionSeconds: listing.sale.antiSnipingExtensionSeconds,
                }
              : undefined,
        },
      });
      await MarketplaceGatewayService.execute(listing.ownerPubky, command);
    }
    await this.seedSandboxAuctionBids(listing, aggregateId);
  }

  private static async seedSandboxAuctionBids(listing: CommerceListingRecord, aggregateId: string): Promise<void> {
    if (listing.sale.format !== 'auction') return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const projection = await MarketplaceGatewayService.getListing(aggregateId);
      const plan = sandboxAuctionSeedPlan(listing, projection);
      if (!plan) return;
      const response = await MarketplaceGatewayService.execute(
        plan.bidderPubky,
        CommerceRecordNormalizer.marketplaceCommand({
          version: 1,
          commandId: crypto.randomUUID(),
          aggregateId,
          expectedRevision: plan.expectedRevision,
          issuedAt: new Date().toISOString(),
          kind: 'auction.place_bid',
          payload: { maximumAmount: plan.maximumAmount },
        }),
      );
      if (
        !response.ok &&
        response.error.code !== 'REVISION_CONFLICT' &&
        response.error.code !== 'IDEMPOTENCY_CONFLICT'
      ) {
        return;
      }
    }
  }

  private static createSyncJob({
    ownerId,
    entityType,
    entityId,
    operation,
    payload,
    now,
  }: {
    ownerId: string;
    entityType: CommerceSyncJobModelSchema['entity_type'];
    entityId: string;
    operation: CommerceSyncJobModelSchema['operation'];
    payload: CommerceSyncJobModelSchema['payload'];
    now: number;
  }): CommerceSyncJobModelSchema {
    return {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      entity_type: entityType,
      entity_id: entityId,
      operation,
      status: 'pending',
      attempts: 0,
      next_attempt_at: now,
      last_error_code: null,
      payload,
      created_at: now,
      updated_at: now,
    };
  }

  private static async syncListingWatch(
    ownerPubky: string,
    listingCompositeId: string,
    watching: boolean,
  ): Promise<void> {
    const separator = listingCompositeId.indexOf(':');
    if (separator <= 0) return;
    try {
      await MarketplaceGatewayService.execute(
        ownerPubky,
        CommerceRecordNormalizer.marketplaceCommand({
          version: 1,
          commandId: crypto.randomUUID(),
          aggregateId: buildMarketplaceListingAggregateId(
            listingCompositeId.slice(0, separator),
            listingCompositeId.slice(separator + 1),
          ),
          expectedRevision: 0,
          issuedAt: new Date().toISOString(),
          kind: watching ? 'listing.watch' : 'listing.unwatch',
          payload: {},
        }),
      );
    } catch {
      // Local favorite remains; watcher-only offers fail closed until the watch command succeeds.
    }
  }
}
