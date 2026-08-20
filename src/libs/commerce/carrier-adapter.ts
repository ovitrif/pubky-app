import { quoteSandboxCalculatedShippingMinor } from './tax-adapter';

export const MARKETPLACE_SANDBOX_CARRIER_ADAPTER_VERSION = 'sandbox-carrier-table-v1';

export const MARKETPLACE_SANDBOX_CARRIERS = {
  sandbox_post: { label: 'Sandbox Post', service: 'ground' },
  sandbox_express: { label: 'Sandbox Express', service: 'express' },
  sandbox_returns: { label: 'Sandbox Returns', service: 'reverse' },
} as const;

export type MarketplaceSandboxCarrierId = keyof typeof MARKETPLACE_SANDBOX_CARRIERS;
export type MarketplaceSandboxCarrierZone = 'us' | 'ca' | 'intl';
export type MarketplaceDeliveryExceptionCode = 'delayed' | 'lost' | 'damaged' | 'refused';

export const MARKETPLACE_DELIVERY_EXCEPTION_CODES = ['delayed', 'lost', 'damaged', 'refused'] as const;

export function sandboxCarrierZone(countryCode = 'US'): MarketplaceSandboxCarrierZone {
  const code = countryCode.trim().toUpperCase();
  if (code === 'US') return 'us';
  if (code === 'CA') return 'ca';
  return 'intl';
}

export function quoteSandboxCarrierRate({
  carrierId,
  countryCode = 'US',
  weightGrams,
  direction = 'outbound',
}: {
  carrierId?: MarketplaceSandboxCarrierId;
  countryCode?: string;
  weightGrams?: number;
  direction?: 'outbound' | 'reverse';
} = {}): {
  carrierId: MarketplaceSandboxCarrierId;
  carrierLabel: string;
  zone: MarketplaceSandboxCarrierZone;
  amountMinor: number;
  adapterVersion: typeof MARKETPLACE_SANDBOX_CARRIER_ADAPTER_VERSION;
} {
  const resolvedId = carrierId ?? (direction === 'reverse' ? 'sandbox_returns' : 'sandbox_post');
  const zone = sandboxCarrierZone(countryCode);
  const baseMinor = quoteSandboxCalculatedShippingMinor(weightGrams);
  const zoneSurchargeMinor = zone === 'us' ? 0 : zone === 'ca' ? 200 : 600;
  const surchargeMinor = (resolvedId === 'sandbox_express' ? 800 : 0) + zoneSurchargeMinor;
  return {
    carrierId: resolvedId,
    carrierLabel: MARKETPLACE_SANDBOX_CARRIERS[resolvedId].label,
    zone,
    amountMinor: baseMinor + surchargeMinor,
    adapterVersion: MARKETPLACE_SANDBOX_CARRIER_ADAPTER_VERSION,
  };
}

export function normalizeSandboxTrackingNumber(value: string): string {
  return value
    .replaceAll(/[^A-Za-z0-9-]/g, '')
    .toUpperCase()
    .slice(0, 200);
}

export function sandboxReverseLabelId(orderId: string): string {
  return `SBR-${orderId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}
