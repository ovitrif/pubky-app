'use client';

import { Typography } from '@/atoms/Typography/Typography';

export function MarketplaceVacationNotice() {
  return (
    <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
      <Typography as="p" className="font-semibold">
        Seller is on vacation
      </Typography>
      <Typography as="p" className="mt-1 text-sm">
        Offers and messages may be slower to answer. Auto-accepted offers still reserve inventory immediately.
      </Typography>
    </div>
  );
}
