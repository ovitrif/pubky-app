import { describe, expect, it } from 'vitest';
import { SANDBOX_GUARANTEE_POLICY, sandboxGuaranteeSummary } from './sandbox-guarantee';

describe('sandbox guarantee policy', () => {
  it('publishes versioned eligibility, exclusions, evidence, and deadlines', () => {
    expect(SANDBOX_GUARANTEE_POLICY.version).toBe(1);
    expect(SANDBOX_GUARANTEE_POLICY.eligibility).toMatch(/Paid sandbox orders/);
    expect(SANDBOX_GUARANTEE_POLICY.exclusions).toMatch(/real Bitcoin/);
    expect(SANDBOX_GUARANTEE_POLICY.evidence).toMatch(/wallet secrets are never accepted/);
    expect(SANDBOX_GUARANTEE_POLICY.claimWindowDays).toBe(14);
    expect(SANDBOX_GUARANTEE_POLICY.resolutionDeadlineDays).toBe(7);
    expect(sandboxGuaranteeSummary()).toBe('Sandbox guarantee policy v1 · claim 14 days · resolve 7 days');
  });
});
