import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceStaffChrome } from './MarketplaceStaffChrome';

vi.mock('@/libs/commerce/sandbox-operator', () => ({
  isMarketplaceSandboxOperator: () => true,
}));

describe('MarketplaceStaffChrome', () => {
  it('links staff consoles and labels the active role', () => {
    render(<MarketplaceStaffChrome role="support" description="Inspect redacted order evidence." />);
    expect(screen.getByText('Sandbox operator · support')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sandbox staff consoles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/marketplace/support');
    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('href', '/marketplace/finance');
    expect(screen.getByRole('link', { name: 'Risk' })).toHaveAttribute('href', '/marketplace/risk');
    expect(screen.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/marketplace/moderation');
    expect(screen.getByText('Inspect redacted order evidence.')).toBeInTheDocument();
    expect(screen.queryByText(/step-up token/)).not.toBeInTheDocument();
  });

  it('discloses step-up on privileged staff consoles', () => {
    render(<MarketplaceStaffChrome role="finance" description="Reconcile the sandbox ledger." />);
    expect(screen.getByText(/5-minute sandbox step-up token/)).toBeInTheDocument();
  });
});
