export type BuyerPaymentStatusKind = 'awaiting_entitlement' | 'confirmed' | 'marketplace_expired' | 'manual_review';

export interface BuyerPaymentStatus {
  kind: BuyerPaymentStatusKind;
  label: string;
  detail: string;
}

export function buyerPaymentStatus(state: string | null | undefined): BuyerPaymentStatus {
  switch (state) {
    case 'confirmed':
      return {
        kind: 'confirmed',
        label: 'Confirmed',
        detail: 'Sandbox payment fact recorded. This is not Bitkit settlement.',
      };
    case 'expired':
    case 'window_elapsed':
      return {
        kind: 'marketplace_expired',
        label: 'Marketplace window expired',
        detail:
          'Order policy elapsed. A late payment enters manual review. This is not a terminal Paykit wallet failure.',
      };
    case 'manual_review':
      return {
        kind: 'manual_review',
        label: 'Manual review',
        detail: 'Awaiting operator reconciliation. Locks keeps upstream or network failures pending.',
      };
    case 'detected':
      return {
        kind: 'awaiting_entitlement',
        label: 'Awaiting entitlement',
        detail: 'Sandbox detected on-chain activity. Entitlement is not confirmed yet.',
      };
    default:
      return {
        kind: 'awaiting_entitlement',
        label: 'Awaiting entitlement',
        detail: 'Waiting for a Locks or Paykit entitlement proof.',
      };
  }
}
