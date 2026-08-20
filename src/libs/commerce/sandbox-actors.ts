export const MARKETPLACE_SANDBOX_BIDDER_A = 'q'.repeat(52);
export const MARKETPLACE_SANDBOX_BIDDER_B = 'w'.repeat(52);
export const MARKETPLACE_SANDBOX_MODERATOR = 'm'.repeat(52);
export const MARKETPLACE_SANDBOX_SUPPORT = 's'.repeat(52);
export const MARKETPLACE_SANDBOX_RISK = 'z'.repeat(52);
export const MARKETPLACE_SANDBOX_FINANCE = 'p'.repeat(52);
export const MARKETPLACE_SANDBOX_OPERATOR_STORAGE_KEY = 'pubky.marketplace.sandboxOperator';
export const MARKETPLACE_SANDBOX_STAFF_ROLE_STORAGE_KEY = 'pubky.marketplace.sandboxStaffRole';

export const MARKETPLACE_SANDBOX_STAFF_ROLES = ['moderator', 'support', 'risk', 'finance'] as const;
export type MarketplaceSandboxStaffRole = (typeof MARKETPLACE_SANDBOX_STAFF_ROLES)[number];

export const MARKETPLACE_SANDBOX_STAFF_PUBKYS = {
  moderator: MARKETPLACE_SANDBOX_MODERATOR,
  support: MARKETPLACE_SANDBOX_SUPPORT,
  risk: MARKETPLACE_SANDBOX_RISK,
  finance: MARKETPLACE_SANDBOX_FINANCE,
} as const;

export const MARKETPLACE_SANDBOX_AUCTION_SEED_BIDDERS = [
  MARKETPLACE_SANDBOX_BIDDER_A,
  MARKETPLACE_SANDBOX_BIDDER_B,
] as const;

export const MARKETPLACE_SANDBOX_AUCTION_SEED_MULTIPLIERS = [8, 6] as const;
