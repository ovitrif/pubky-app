import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketplaceVacationNotice } from './MarketplaceVacationNotice';

describe('MarketplaceVacationNotice', () => {
  it('exposes a live vacation status for the listing page', () => {
    render(<MarketplaceVacationNotice />);

    expect(screen.getByRole('status')).toHaveTextContent('Seller is on vacation');
  });
});
