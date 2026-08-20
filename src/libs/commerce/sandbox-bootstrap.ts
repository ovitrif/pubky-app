import type { CommerceListingRecord } from './marketplace-records';
import {
  MARKETPLACE_SANDBOX_AUCTION_SEED_BIDDERS,
  MARKETPLACE_SANDBOX_AUCTION_SEED_MULTIPLIERS,
} from './sandbox-actors';
import type { CommerceMoney } from './transaction-contracts';

export function sandboxListingAutoAcceptAmount(
  listing: CommerceListingRecord,
): CommerceMoney | null {
  return listing.sale.format === 'auction' ? null : (listing.sale.autoAcceptAmount ?? null);
}

export function sandboxListingNeedsReregister(
  existing: { autoAcceptAmount?: CommerceMoney | null } | null,
  listing: CommerceListingRecord,
): boolean {
  if (!existing) return true;
  return JSON.stringify(existing.autoAcceptAmount ?? null) !== JSON.stringify(sandboxListingAutoAcceptAmount(listing));
}

export function sandboxAuctionSeedPlan(
  listing: CommerceListingRecord,
  projection: {
    serverRevision: number;
    unitPrice: CommerceMoney;
    auction: { bidCount: number; minimumIncrement: CommerceMoney } | null;
  } | null,
): { bidderPubky: string; expectedRevision: number; maximumAmount: CommerceMoney } | null {
  if (listing.sale.format !== 'auction' || !projection?.auction) return null;
  const index = projection.auction.bidCount;
  if (index >= MARKETPLACE_SANDBOX_AUCTION_SEED_BIDDERS.length) return null;
  const multiplier = MARKETPLACE_SANDBOX_AUCTION_SEED_MULTIPLIERS[index];
  return {
    bidderPubky: MARKETPLACE_SANDBOX_AUCTION_SEED_BIDDERS[index],
    expectedRevision: projection.serverRevision,
    maximumAmount: {
      ...projection.unitPrice,
      amountMinor: projection.unitPrice.amountMinor + projection.auction.minimumIncrement.amountMinor * multiplier,
    },
  };
}
