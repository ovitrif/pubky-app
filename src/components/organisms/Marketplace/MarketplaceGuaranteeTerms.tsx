'use client';

import { Typography } from '@/atoms/Typography/Typography';
import { SANDBOX_GUARANTEE_POLICY, sandboxGuaranteeSummary } from '@/libs/commerce/sandbox-guarantee';

export function MarketplaceGuaranteeTerms({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="marketplace-guarantee-heading" className="grid gap-2">
      <Typography as="h3" id="marketplace-guarantee-heading" className="text-sm font-semibold">
        {SANDBOX_GUARANTEE_POLICY.title}
      </Typography>
      <Typography as="p" className="text-xs text-muted-foreground">
        {sandboxGuaranteeSummary()}
      </Typography>
      {!compact && (
        <dl className="grid gap-2 text-sm">
          <div>
            <Typography as="dt" className="text-xs text-muted-foreground">
              Eligibility
            </Typography>
            <Typography as="dd">{SANDBOX_GUARANTEE_POLICY.eligibility}</Typography>
          </div>
          <div>
            <Typography as="dt" className="text-xs text-muted-foreground">
              Exclusions
            </Typography>
            <Typography as="dd">{SANDBOX_GUARANTEE_POLICY.exclusions}</Typography>
          </div>
          <div>
            <Typography as="dt" className="text-xs text-muted-foreground">
              Evidence
            </Typography>
            <Typography as="dd">{SANDBOX_GUARANTEE_POLICY.evidence}</Typography>
          </div>
          <div>
            <Typography as="dt" className="text-xs text-muted-foreground">
              Deadlines
            </Typography>
            <Typography as="dd">
              Claim within {SANDBOX_GUARANTEE_POLICY.claimWindowDays} days of delivery or digital access. Seller or
              operator resolution within {SANDBOX_GUARANTEE_POLICY.resolutionDeadlineDays} days after evidence.
            </Typography>
          </div>
        </dl>
      )}
      <Typography as="p" className="text-sm">
        {SANDBOX_GUARANTEE_POLICY.disclaimer}
      </Typography>
    </section>
  );
}
