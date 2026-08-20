import { describe, expect, it } from 'vitest';
import { buyerPaymentStatus } from './buyer-payment-status';

describe('buyerPaymentStatus', () => {
  it('maps sandbox and contract states to the four buyer-visible labels', () => {
    expect(buyerPaymentStatus('awaiting_entitlement').kind).toBe('awaiting_entitlement');
    expect(buyerPaymentStatus('created').label).toBe('Awaiting entitlement');
    expect(buyerPaymentStatus('detected').label).toBe('Awaiting entitlement');
    expect(buyerPaymentStatus('confirmed')).toMatchObject({ kind: 'confirmed', label: 'Confirmed' });
    expect(buyerPaymentStatus('expired').kind).toBe('marketplace_expired');
    expect(buyerPaymentStatus('window_elapsed').label).toBe('Marketplace window expired');
    expect(buyerPaymentStatus('manual_review')).toMatchObject({
      kind: 'manual_review',
      label: 'Manual review',
    });
  });
});
