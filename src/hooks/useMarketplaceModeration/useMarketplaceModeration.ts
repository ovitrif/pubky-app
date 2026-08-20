'use client';

import { useEffect, useState } from 'react';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceStaffPage } from '@/hooks/useMarketplaceStaffPage/useMarketplaceStaffPage';
import type { MarketplaceReport } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export type MarketplaceModerationDecision =
  | 'dismiss'
  | 'warn'
  | 'restrict_listing'
  | 'delist'
  | 'visibility_limit'
  | 'message_limit'
  | 'transaction_hold'
  | 'suspend'
  | 'ban';

export function useMarketplaceModeration() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const staff = useMarketplaceStaffPage('moderator');
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!currentUserPubky) return;
    const [nextReports, nextSearch] = await Promise.all([
      CommerceController.getMarketplaceReports(),
      query.trim() ? CommerceController.searchMarketplaceAdmin(query).catch(() => null) : Promise.resolve(null),
    ]);
    setReports(nextSearch?.reports ?? nextReports);
  };

  useEffect(() => {
    if (!currentUserPubky || !staff.ready) {
      setIsLoading(Boolean(currentUserPubky) && !staff.ready);
      return;
    }
    refresh()
      .catch(() => setError('This account does not have marketplace moderator access.'))
      .finally(() => setIsLoading(false));
    // refresh is recreated each render; React Compiler memoizes the hook body.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/query refresh only
  }, [currentUserPubky, query, staff.ready]);

  const decide = async (report: MarketplaceReport, decision: MarketplaceModerationDecision) => {
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `report:${report.id}`,
        expectedRevision: report.revision ?? 1,
        issuedAt: new Date().toISOString(),
        kind: 'trust.decide',
        payload: { reportId: report.id, decision, notes: `Sandbox moderator decision: ${decision}.` },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      await refresh();
    } catch {
      setError('Could not record this moderation decision.');
    }
  };

  const assign = async (report: MarketplaceReport) => {
    if (!currentUserPubky) return;
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `report:${report.id}`,
        expectedRevision: report.revision ?? 1,
        issuedAt: new Date().toISOString(),
        kind: 'trust.assign',
        payload: { reportId: report.id, assigneePubky: currentUserPubky },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      await refresh();
    } catch {
      setError('Could not assign this report.');
    }
  };

  const reverse = async (report: MarketplaceReport) => {
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `report:${report.id}`,
        expectedRevision: report.revision ?? 1,
        issuedAt: new Date().toISOString(),
        kind: 'trust.reverse',
        payload: { reportId: report.id, notes: 'Sandbox moderator reversal.' },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      await refresh();
    } catch {
      setError('Could not reverse this decision.');
    }
  };

  return {
    reports,
    isLoading,
    error,
    query,
    setQuery,
    decide,
    assign,
    reverse,
    isOperator: staff.isOperator,
  };
}
