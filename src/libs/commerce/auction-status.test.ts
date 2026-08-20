import { describe, expect, it } from 'vitest';
import {
  marketplaceAuctionStanding,
  marketplaceAuctionStandingCopy,
  marketplaceMinimumNextBid,
} from './auction-status';

const PRICE = { amountMinor: 4_500, currency: 'USD', exponent: 2 } as const;
const BUYER = 'q'.repeat(52);
const OTHER = 'w'.repeat(52);

describe('marketplaceMinimumNextBid', () => {
  it('requires the next proxy maximum to exceed the visible price by one minor unit', () => {
    expect(marketplaceMinimumNextBid(PRICE)).toEqual({ amountMinor: 4_501, currency: 'USD', exponent: 2 });
  });
});

describe('marketplaceAuctionStanding', () => {
  it('keeps standing private until a buyer is signed in', () => {
    expect(marketplaceAuctionStanding(null, BUYER, [BUYER])).toBe('signed_out');
    expect(marketplaceAuctionStandingCopy('signed_out')).toBe('Sign in to see your standing');
  });

  it('reports leading, outbid, and not-bidding from public leader and history only', () => {
    expect(marketplaceAuctionStanding(BUYER, BUYER, [BUYER, OTHER])).toBe('leading');
    expect(marketplaceAuctionStanding(OTHER, BUYER, [BUYER, OTHER])).toBe('outbid');
    expect(marketplaceAuctionStanding(BUYER, OTHER, [OTHER])).toBe('not_bidding');
    expect(marketplaceAuctionStandingCopy('leading')).toBe('You are the high bidder');
    expect(marketplaceAuctionStandingCopy('outbid')).toBe('You have been outbid');
    expect(marketplaceAuctionStandingCopy('not_bidding')).toBe('You have not placed a bid');
  });
});
