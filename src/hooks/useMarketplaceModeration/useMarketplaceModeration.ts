'use client';

import { useEffect, useState } from 'react';
import { CommerceController } from '@/controllers/commerce/commerce';
import type { MarketplaceReport } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export function useMarketplaceModeration() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserPubky) {
      setIsLoading(false);
      return;
    }
    CommerceController.getMarketplaceReports()
      .then(setReports)
      .catch(() => setError('This account does not have marketplace moderator access.'))
      .finally(() => setIsLoading(false));
  }, [currentUserPubky]);

  const decide = async (reportId: string, decision: 'dismiss' | 'restrict_listing') => {
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `report:${reportId}`,
        expectedRevision: 1,
        issuedAt: new Date().toISOString(),
        kind: 'trust.decide',
        payload: { reportId, decision, notes: 'Sandbox moderator decision.' },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      const next = await CommerceController.getMarketplaceReports();
      setReports(next);
    } catch {
      setError('Could not record this moderation decision.');
    }
  };

  return { reports, isLoading, error, decide };
}
