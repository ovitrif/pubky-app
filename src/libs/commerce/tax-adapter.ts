export const MARKETPLACE_SANDBOX_TAX_ADAPTER_VERSION = 'sandbox-us-8pct-v1';
export const MARKETPLACE_SANDBOX_SHIPPING_ADAPTER_VERSION = 'sandbox-flat-1200-v1';
export const MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR = 1_200;
export const MARKETPLACE_SANDBOX_TAX_RATE_BPS = 800;

export type SandboxFulfillment = 'physical' | 'digital' | 'pickup';

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

export function quoteSandboxCheckoutTotals({
  subtotalMinor,
  discountMinor,
  fulfillment,
}: {
  subtotalMinor: number;
  discountMinor: number;
  fulfillment: SandboxFulfillment;
}): SandboxCheckoutQuote {
  const shippingMinor = fulfillment === 'digital' ? 0 : MARKETPLACE_SANDBOX_FLAT_SHIPPING_MINOR;
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
  items: Array<{ sellerId: string; lineSubtotalMinor: number; fulfillment: SandboxFulfillment }>,
): SandboxCheckoutQuote & { sellerGroupCount: number } {
  const groups = new Map<string, { subtotalMinor: number; fulfillments: SandboxFulfillment[] }>();
  for (const item of items) {
    const group = groups.get(item.sellerId) ?? { subtotalMinor: 0, fulfillments: [] };
    group.subtotalMinor += item.lineSubtotalMinor;
    group.fulfillments.push(item.fulfillment);
    groups.set(item.sellerId, group);
  }
  const quoted = [...groups.values()].map((group) =>
    quoteSandboxCheckoutTotals({
      subtotalMinor: group.subtotalMinor,
      discountMinor: 0,
      fulfillment: resolveSandboxOrderFulfillment(group.fulfillments),
    }),
  );
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
