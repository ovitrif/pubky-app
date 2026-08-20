export const SANDBOX_GUARANTEE_POLICY = {
  version: 1 as const,
  title: 'Sandbox guarantee policy v1',
  eligibility: 'Paid sandbox orders for active listings while the seller is not banned and the buyer is not blocked.',
  exclusions:
    'Closed auctions without a winning order, watcher-only listings without an accepted offer, digital goods after the credential window, and any real Bitcoin movement.',
  evidence:
    'Order id, listing revision, payment id, and optional photo hashes. Recovery phrases and wallet secrets are never accepted.',
  claimWindowDays: 14,
  resolutionDeadlineDays: 7,
  disclaimer:
    'This is not legal escrow, card authorization, marketplace custody, or a Paykit refund. The version is frozen on the order at checkout.',
} as const;

export function sandboxGuaranteeSummary(): string {
  return `${SANDBOX_GUARANTEE_POLICY.title} · claim ${SANDBOX_GUARANTEE_POLICY.claimWindowDays} days · resolve ${SANDBOX_GUARANTEE_POLICY.resolutionDeadlineDays} days`;
}
