import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketplaceGuaranteeTerms } from './MarketplaceGuaranteeTerms';

describe('MarketplaceGuaranteeTerms', () => {
  it('shows eligibility, exclusions, evidence, and deadlines before purchase', () => {
    render(<MarketplaceGuaranteeTerms />);
    expect(screen.getByRole('heading', { name: 'Sandbox guarantee policy v1' })).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Exclusions')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Deadlines')).toBeInTheDocument();
    expect(screen.getByText(/Claim within 14 days/)).toBeInTheDocument();
    expect(screen.getByText(/not legal escrow/)).toBeInTheDocument();
  });
});
