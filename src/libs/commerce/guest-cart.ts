export const MARKETPLACE_GUEST_CART_OWNER = '1'.repeat(52);

export function marketplaceCartOwner(currentUserPubky: string | null | undefined): string {
  return currentUserPubky ?? MARKETPLACE_GUEST_CART_OWNER;
}

export function isMarketplaceGuestCartOwner(ownerPubky: string): boolean {
  return ownerPubky === MARKETPLACE_GUEST_CART_OWNER;
}
