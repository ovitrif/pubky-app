import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
  MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
  quoteSandboxCalculatedShippingMinor,
  quoteSandboxCart,
  quoteSandboxCheckoutTotals,
  quoteSandboxListingShippingMinor,
  resolveListingFulfillmentMethod,
  resolveSandboxOrderFulfillment,
} from './tax-adapter';

describe('sandbox tax adapter', () => {
  it('quotes the frozen 8 percent sandbox rate and versions the result', () => {
    expect(quoteSandboxCheckoutTotals({ subtotalMinor: 12_500, discountMinor: 0, fulfillment: 'physical' })).toEqual({
      shippingMinor: 1_200,
      taxMinor: 1_096,
      totalMinor: 14_796,
      taxableMinor: 13_700,
      taxAdapterVersion: MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
      shippingAdapterVersion: MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
    });
  });

  it('waives shipping for digital-only seller groups and still taxes the subtotal', () => {
    expect(quoteSandboxCheckoutTotals({ subtotalMinor: 2_400, discountMinor: 0, fulfillment: 'digital' })).toEqual({
      shippingMinor: 0,
      taxMinor: 192,
      totalMinor: 2_592,
      taxableMinor: 2_400,
      taxAdapterVersion: MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
      shippingAdapterVersion: MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
    });
  });

  it('never lets a discount produce a negative taxable amount', () => {
    expect(
      quoteSandboxCheckoutTotals({ subtotalMinor: 1_000, discountMinor: 2_000, fulfillment: 'digital' }).taxMinor,
    ).toBe(0);
  });

  it('quotes one shipping charge per seller and treats pickup like physical shipping', () => {
    const quote = quoteSandboxCart([
      { sellerId: 'a'.repeat(52), lineSubtotalMinor: 9_500, fulfillment: 'pickup' },
      { sellerId: 'a'.repeat(52), lineSubtotalMinor: 9_500, fulfillment: 'pickup' },
      { sellerId: 'k'.repeat(52), lineSubtotalMinor: 2_400, fulfillment: 'digital' },
    ]);
    expect(quote.sellerGroupCount).toBe(2);
    expect(quote.shippingMinor).toBe(1_200);
    expect(quote.taxMinor).toBe(Math.round((19_000 + 1_200) * 0.08) + Math.round(2_400 * 0.08));
  });

  it('uses the cheapest listing shipping option and one shipment per seller', () => {
    expect(
      quoteSandboxListingShippingMinor({
        fulfillment: 'physical',
        shippingOptions: [{ pricing: 'free' }],
      }),
    ).toBe(0);
    expect(
      quoteSandboxListingShippingMinor({
        fulfillment: 'physical',
        shippingOptions: [{ pricing: 'flat', price: { amountMinor: 800 } }],
      }),
    ).toBe(800);
    expect(quoteSandboxCalculatedShippingMinor(1_800)).toBe(1_400);
    expect(
      quoteSandboxListingShippingMinor({
        fulfillment: 'physical',
        shippingOptions: [{ pricing: 'calculated' }],
        packageWeightGrams: 1_800,
      }),
    ).toBe(1_400);

    const quote = quoteSandboxCart([
      { sellerId: 'y'.repeat(52), lineSubtotalMinor: 8_800, fulfillment: 'physical', shippingMinor: 0 },
      { sellerId: 'y'.repeat(52), lineSubtotalMinor: 12_500, fulfillment: 'pickup', shippingMinor: 1_200 },
    ]);
    expect(quote.shippingMinor).toBe(1_200);
    expect(quote.totalMinor).toBe(8_800 + 12_500 + 1_200 + Math.round((8_800 + 12_500 + 1_200) * 0.08));
  });

  it('resolves mixed seller fulfillments the same way checkout does', () => {
    expect(resolveSandboxOrderFulfillment(['digital'])).toBe('digital');
    expect(resolveSandboxOrderFulfillment(['pickup', 'digital'])).toBe('pickup');
    expect(resolveSandboxOrderFulfillment(['physical', 'pickup'])).toBe('physical');
    expect(resolveListingFulfillmentMethod(['pickup'])).toBe('pickup');
    expect(resolveListingFulfillmentMethod(['digital'])).toBe('digital');
  });
});
