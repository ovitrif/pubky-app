import type { CommerceMoney } from './transaction-contracts';

export type MarketplaceAuctionStanding = 'signed_out' | 'leading' | 'outbid' | 'not_bidding';

export function marketplaceMinimumNextBid(currentPrice: CommerceMoney): CommerceMoney {
  return {
    ...currentPrice,
    amountMinor: currentPrice.amountMinor + 1,
  };
}

export function marketplaceAuctionStanding(
  currentUserPubky: string | null | undefined,
  leaderPubky: string | null | undefined,
  bidderPubkys: readonly string[],
): MarketplaceAuctionStanding {
  if (!currentUserPubky) return 'signed_out';
  if (leaderPubky === currentUserPubky) return 'leading';
  if (bidderPubkys.includes(currentUserPubky)) return 'outbid';
  return 'not_bidding';
}

export function marketplaceAuctionStandingCopy(standing: MarketplaceAuctionStanding): string {
  if (standing === 'signed_out') return 'Sign in to see your standing';
  if (standing === 'leading') return 'You are the high bidder';
  if (standing === 'outbid') return 'You have been outbid';
  return 'You have not placed a bid';
}
