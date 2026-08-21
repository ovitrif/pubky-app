import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MarketplaceOrder, MarketplacePayment } from '@/services/marketplace/marketplace';
import { asOpaque } from '@/test-utils/type-assertions';
import { MarketplaceOrders } from './MarketplaceOrders';

const buyerPubky = 'b'.repeat(52);
const sellerPubky = 'y'.repeat(52);
const money = (amountMinor: number) => ({ amountMinor, currency: 'USD', exponent: 2 });

const pendingOrder = asOpaque<MarketplaceOrder>({
  id: '8567b5fe-e405-4963-8224-169d55d270eb',
  buyerPubky,
  sellerPubky,
  revision: 2,
  state: 'pending_payment',
  origin: 'buy_now',
  fulfillment: 'physical',
  payoutState: 'held',
  couponCode: null,
  lines: [
    {
      listingAggregateId: `listing:${sellerPubky}_silver_signet`,
      title: 'Brutalist silver signet',
      quantity: 1,
    },
  ],
  subtotal: money(20_000),
  discount: money(0),
  shipping: money(1_200),
  tax: money(1_696),
  total: money(22_896),
  deliveryAddress: {
    name: 'Capybara Buyer',
    line1: '200 Market Street',
    line2: '',
    city: 'Austin',
    region: 'TX',
    postalCode: '78701',
    countryCode: 'US',
  },
  reviews: [],
  shipment: null,
  dispute: null,
  returnRequest: null,
  digitalDelivery: null,
  externalRefund: null,
});

const pendingPayment = asOpaque<MarketplacePayment>({
  id: 'c8166552-969d-4c06-8419-e538ff33d7cd',
  orderId: pendingOrder.id,
  buyerPubky,
  sellerPubky,
  revision: 1,
  adapter: 'sandbox',
  state: 'awaiting_entitlement',
  confirmations: 0,
  amount: money(22_896),
});

const completedOrder = asOpaque<MarketplaceOrder>({
  ...pendingOrder,
  id: '9a8bf4b2-b885-4150-a0b2-f22a440df5a6',
  state: 'completed',
  origin: 'offer',
  lines: [
    {
      listingAggregateId: `listing:${sellerPubky}_jazz_first_press`,
      title: 'Rare jazz first pressing',
      quantity: 1,
    },
  ],
  subtotal: money(3_800),
  shipping: money(1_200),
  tax: money(400),
  total: money(5_400),
  shipment: {
    carrier: 'Sandbox Post',
    trackingNumber: 'JAZZ-LIVE-1',
    state: 'delivered',
    shippedAt: '2026-08-21T02:00:00.000Z',
    deliveredAt: '2026-08-21T02:10:00.000Z',
    exception: null,
  },
  reviews: [
    {
      id: '52f596d8-8c22-46f3-a28c-a67e12f85556',
      reviewerPubky: buyerPubky,
      subjectPubky: sellerPubky,
      rating: 5,
      text: 'Pressing arrived as described.',
      editedAt: null,
      reply: null,
    },
  ],
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/marketplace/orders',
}));

vi.mock('@/stores/auth/auth.store', () => ({
  useAuthStore: (select: (state: { currentUserPubky: string }) => unknown) => select({ currentUserPubky: buyerPubky }),
}));

vi.mock('@/hooks/useMarketplaceOrders/useMarketplaceOrders', () => ({
  useMarketplaceOrders: () => ({
    orders: [
      { order: pendingOrder, payment: pendingPayment, receipt: null },
      { order: completedOrder, payment: { ...pendingPayment, state: 'confirmed' }, receipt: null },
    ],
    isLoading: false,
    error: null,
    advancePayment: vi.fn(),
    actOnOrder: vi.fn(async () => true),
  }),
}));

vi.mock('@/organisms/ContentLayout/ContentLayout', () => ({
  ContentLayout: ({ children }: { children: ReactNode }) => <main className="w-full py-6">{children}</main>,
}));

describe('MarketplaceOrders accessibility', () => {
  it('has no serious or critical automated violations on pending and completed orders', async () => {
    const { container } = render(<MarketplaceOrders />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
