import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_SANDBOX_CARRIER_ADAPTER_VERSION,
  normalizeSandboxTrackingNumber,
  quoteSandboxCarrierRate,
  sandboxCarrierZone,
  sandboxReverseLabelId,
} from './carrier-adapter';
import { quoteSandboxCalculatedShippingMinor } from './tax-adapter';

describe('sandbox carrier adapter', () => {
  it('keeps US Sandbox Post equal to the existing calculated listing quote', () => {
    expect(quoteSandboxCarrierRate({ weightGrams: 1_800 })).toEqual({
      carrierId: 'sandbox_post',
      carrierLabel: 'Sandbox Post',
      zone: 'us',
      amountMinor: quoteSandboxCalculatedShippingMinor(1_800),
      adapterVersion: MARKETPLACE_SANDBOX_CARRIER_ADAPTER_VERSION,
    });
    expect(quoteSandboxCarrierRate({ weightGrams: 1_800 }).amountMinor).toBe(1_400);
  });

  it('labels express, zone, and reverse quotes without changing the default US ground rate', () => {
    expect(quoteSandboxCarrierRate({ carrierId: 'sandbox_express', weightGrams: 1_000 }).amountMinor).toBe(
      quoteSandboxCalculatedShippingMinor(1_000) + 800,
    );
    expect(sandboxCarrierZone('ca')).toBe('ca');
    expect(quoteSandboxCarrierRate({ countryCode: 'CA', weightGrams: 1_000 }).amountMinor).toBe(
      quoteSandboxCalculatedShippingMinor(1_000) + 200,
    );
    expect(quoteSandboxCarrierRate({ direction: 'reverse', weightGrams: 1_000 })).toMatchObject({
      carrierId: 'sandbox_returns',
      carrierLabel: 'Sandbox Returns',
    });
  });

  it('normalizes tracking and derives a stable reverse-label id', () => {
    expect(normalizeSandboxTrackingNumber(' track 55! ')).toBe('TRACK55');
    expect(sandboxReverseLabelId('43a8f872-ce9b-4481-82e2-a7abef0c9ac7')).toBe('SBR-43A8F872CE9B');
  });
});
