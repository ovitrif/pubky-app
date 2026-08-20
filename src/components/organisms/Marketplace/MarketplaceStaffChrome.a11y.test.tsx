import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceStaffChrome } from './MarketplaceStaffChrome';

vi.mock('@/libs/commerce/sandbox-operator', () => ({
  isMarketplaceSandboxOperator: () => true,
}));

describe('MarketplaceStaffChrome accessibility', () => {
  it('has no serious or critical automated violations', async () => {
    const { container } = render(
      <MarketplaceStaffChrome role="support" description="Inspect redacted order evidence." />,
    );
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
