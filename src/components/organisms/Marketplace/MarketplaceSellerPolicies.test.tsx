import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketplaceSellerPolicies } from './MarketplaceSellerPolicies';

describe('MarketplaceSellerPolicies', () => {
  it('announces shop shipping, listing returns, and sandbox guarantee copy', () => {
    render(
      <MarketplaceSellerPolicies
        shop={{
          shippingPolicy: 'Ships within three business days.',
          returnPolicy: 'Returns accepted within 30 days.',
        }}
        listingShipping="Free shipping"
        listingReturn={{
          acceptsReturns: true,
          returnWindowDays: 30,
          buyerPaysReturnShipping: true,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Buying policies' })).toBeInTheDocument();
    expect(screen.getByText('Free shipping')).toBeInTheDocument();
    expect(screen.getByText('Ships within three business days.')).toBeInTheDocument();
    expect(screen.getByText('Returns accepted within 30 days. Buyer pays return shipping.')).toBeInTheDocument();
    expect(screen.getByText(/Sandbox guarantee policy v1/)).toBeInTheDocument();
  });
});
