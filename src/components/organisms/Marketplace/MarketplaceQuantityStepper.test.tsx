import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceQuantityStepper } from './MarketplaceQuantityStepper';

describe('MarketplaceQuantityStepper', () => {
  it('increases and decreases within the available range', () => {
    const onChange = vi.fn();
    render(<MarketplaceQuantityStepper value={2} max={4} label="Vintage leather boots" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase Vintage leather boots quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Vintage leather boots quantity' }));

    expect(onChange).toHaveBeenCalledWith(3);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('disables increase at the available maximum', () => {
    render(<MarketplaceQuantityStepper value={4} max={4} label="Vintage leather boots" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Increase Vintage leather boots quantity' })).toBeDisabled();
  });
});
