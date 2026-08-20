import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_REDACTED,
  MARKETPLACE_REDACTED_CREDENTIAL_ID,
  redactMarketplaceOrderForStaff,
} from './staff-order';

const order = {
  deliveryAddress: {
    name: 'Alice Buyer',
    line1: '1 Market Street',
    line2: 'Apt 4',
    city: 'New York',
    region: 'NY',
    postalCode: '10001',
    countryCode: 'US',
  },
  digitalDelivery: { credentialId: '11111111-1111-4111-8111-111111111111' },
  reviews: [{ text: 'Great boots', reply: 'Thanks' }],
  cancellationReason: 'Changed mind',
  dispute: { reason: 'Item damaged', rationale: 'Photo evidence' },
  returnRequest: { reason: 'Wrong size', inspection: { notes: 'Box opened' } },
  externalRefund: { transactionId: 'txid-secret-abc' },
};

describe('redactMarketplaceOrderForStaff', () => {
  it('strips delivery, credential, and narrative secrets for support', () => {
    const redacted = redactMarketplaceOrderForStaff(order);
    expect(redacted.deliveryAddress).toMatchObject({
      name: MARKETPLACE_REDACTED,
      line1: MARKETPLACE_REDACTED,
      postalCode: MARKETPLACE_REDACTED,
      city: 'New York',
      countryCode: 'US',
    });
    expect(redacted.digitalDelivery?.credentialId).toBe(MARKETPLACE_REDACTED_CREDENTIAL_ID);
    expect(redacted.reviews[0]).toMatchObject({ text: MARKETPLACE_REDACTED, reply: MARKETPLACE_REDACTED });
    expect(redacted.externalRefund?.transactionId).toBe(MARKETPLACE_REDACTED);
    expect(JSON.stringify(redacted)).not.toContain('Alice Buyer');
    expect(JSON.stringify(redacted)).not.toContain('1 Market Street');
    expect(JSON.stringify(redacted)).not.toContain('txid-secret-abc');
  });

  it('keeps refund evidence for finance', () => {
    const redacted = redactMarketplaceOrderForStaff(order, { keepRefundEvidence: true });
    expect(redacted.externalRefund?.transactionId).toBe('txid-secret-abc');
    expect(redacted.deliveryAddress?.line1).toBe(MARKETPLACE_REDACTED);
  });

  it('keeps a pending auction address as null', () => {
    const redacted = redactMarketplaceOrderForStaff({ ...order, deliveryAddress: null });
    expect(redacted.deliveryAddress).toBeNull();
  });
});
