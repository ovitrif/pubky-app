import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { MarketplaceGuaranteeTerms } from './MarketplaceGuaranteeTerms';

describe('MarketplaceGuaranteeTerms accessibility', () => {
  it('has no serious or critical automated violations', async () => {
    const { container } = render(<MarketplaceGuaranteeTerms />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
