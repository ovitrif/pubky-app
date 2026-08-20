'use client';

import { useEffect, useState } from 'react';
import type { MarketplaceSandboxStaffRole } from '@/libs/commerce/sandbox-actors';
import { isMarketplaceSandboxOperator, setMarketplaceSandboxStaffRole } from '@/libs/commerce/sandbox-operator';

export function useMarketplaceStaffPage(role: MarketplaceSandboxStaffRole) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isMarketplaceSandboxOperator()) {
      setMarketplaceSandboxStaffRole(role);
    }
    setReady(true);
  }, [role]);

  return { ready, isOperator: isMarketplaceSandboxOperator() };
}
