export const MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION = 'sandbox-us-8pct-v1';
export const MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION = 'sandbox-listing-shipping-v1';
export const MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR = 1_200;
export const MARKETPLACE_SANDBOX_TAX_RATE_BPS = 800;
export const MARKETPLACE_SANDBOX_CALCULATED_BASE_MINOR = 600;
export const MARKETPLACE_SANDBOX_CALCULATED_RATE_PER_KG_MINOR = 400;

export type SandboxFulfillment = 'physical' | 'digital' | 'pickup';

export interface SandboxShippingOptionQuote {
  pricing: 'free' | 'flat' | 'calculated';
  price?: { amountMinor: number };
}

export interface SandboxCheckoutQuote {
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxableMinor: number;
  taxAdapterVersion: typeof MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION;
  shippingAdapterVersion: typeof MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION;
}

export function resolveSandboxOrderFulfillment(fulfillments: SandboxFulfillment[]): SandboxFulfillment {
  if (fulfillments.length > 0 && fulfillments.every((fulfillment) => fulfillment === 'digital')) return 'digital';
  if (fulfillments.every((fulfillment) => fulfillment === 'pickup' || fulfillment === 'digital')) return 'pickup';
  return 'physical';
}

export function resolveListingFulfillmentMethod(methods: SandboxFulfillment[]): SandboxFulfillment {
  if (methods.includes('digital') && methods.every((method) => method === 'digital')) return 'digital';
  if (methods.includes('physical')) return 'physical';
  if (methods.includes('pickup')) return 'pickup';
  return 'physical';
}

export function quoteSandboxCalculatedShippingMinor(weightGrams = 1_000): number {
  const kilograms = Math.max(1, Math.ceil(weightGrams / 1_000));
  return MARKETPLACE_SANDBOX_CALCULATED_BASE_MINOR + kilograms * MARKETPLACE_SANDBOX_CALCULATED_RATE_PER_KG_MINOR;
}

export function quoteSandboxListingShippingMinor({
  fulfillment,
  shippingOptions = [],
  packageWeightGrams,
}: {
  fulfillment: SandboxFulfillment;
  shippingOptions?: SandboxShippingOptionQuote[];
  packageWeightGrams?: number;
}): number {
  if (fulfillment === 'digital') return 0;
  if (shippingOptions.length === 0) return MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR;
  return Math.min(
    ...shippingOptions.map((option) => {
      if (option.pricing === 'free') return 0;
      if (option.pricing === 'flat') return option.price?.amountMinor ?? MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR;
      return quoteSandboxCalculatedShippingMinor(packageWeightGrams);
    }),
  );
}

export function quoteSandboxCheckoutTotals({
  subtotalMinor,
  discountMinor,
  fulfillment,
  shippingMinor: shippingOverride,
}: {
  subtotalMinor: number;
  discountMinor: number;
  fulfillment: SandboxFulfillment;
  shippingMinor?: number;
}): SandboxCheckoutQuote {
  const shippingMinor = fulfillment === 'digital' ? 0 : (shippingOverride ?? MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR);
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor) + shippingMinor;
  const taxMinor = Math.round((taxableMinor * MARKETPLACE_SANDBOX_TAX_RATE_BPS) / 10_000);
  return {
    shippingMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
    taxableMinor,
    taxAdapterVersion: MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
    shippingAdapterVersion: MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
  };
}

export function quoteSandboxCart(
  items: Array<{
    sellerId: string;
    lineSubtotalMinor: number;
    fulfillment: SandboxFulfillment;
    shippingMinor?: number;
  }>,
): SandboxCheckoutQuote & { sellerGroupCount: number } {
  const groups = new Map<
    string,
    { subtotalMinor: number; fulfillments: SandboxFulfillment[]; shippingMinors: number[] }
  >();
  for (const item of items) {
    const group = groups.get(item.sellerId) ?? { subtotalMinor: 0, fulfillments: [], shippingMinors: [] };
    group.subtotalMinor += item.lineSubtotalMinor;
    group.fulfillments.push(item.fulfillment);
    group.shippingMinors.push(item.shippingMinor ?? MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR);
    groups.set(item.sellerId, group);
  }
  const quoted = [...groups.values()].map((group) => {
    const fulfillment = resolveSandboxOrderFulfillment(group.fulfillments);
    return quoteSandboxCheckoutTotals({
      subtotalMinor: group.subtotalMinor,
      discountMinor: 0,
      fulfillment,
      shippingMinor: fulfillment === 'digital' ? 0 : Math.max(...group.shippingMinors),
    });
  });
  return {
    shippingMinor: quoted.reduce((total, quote) => total + quote.shippingMinor, 0),
    taxMinor: quoted.reduce((total, quote) => total + quote.taxMinor, 0),
    totalMinor: quoted.reduce((total, quote) => total + quote.totalMinor, 0),
    taxableMinor: quoted.reduce((total, quote) => total + quote.taxableMinor, 0),
    taxAdapterVersion: MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION,
    shippingAdapterVersion: MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION,
    sellerGroupCount: quoted.length,
  };
}
