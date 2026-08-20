'use client';

import { useEffect, useState } from 'react';
import { CommerceController } from '@/controllers/commerce/commerce';
import type { MarketplaceReport, MarketplaceRiskSignal } from '@/services/marketplace/marketplace';
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
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);
  const [invariants, setInvariants] = useState<{
    unbalancedOrders: string[];
    oversoldListings: string[];
    duplicateAuctionWinners: string[];
    stuckFulfillment: string[];
  } | null>(null);
  const [riskSignals, setRiskSignals] = useState<MarketplaceRiskSignal[]>([]);
  const [riskTargetId, setRiskTargetId] = useState('');
  const [riskTargetType, setRiskTargetType] = useState<MarketplaceRiskSignal['targetType']>('listing');
  const [riskType, setRiskType] = useState<MarketplaceRiskSignal['signalType']>('auction_manipulation');

  const refresh = async () => {
    if (!currentUserPubky) return;
    const [nextReports, nextSearch, nextInvariants, nextSignals] = await Promise.all([
      CommerceController.getMarketplaceReports(),
      query.trim() ? CommerceController.searchMarketplaceAdmin(query).catch(() => null) : Promise.resolve(null),
      CommerceController.getMarketplaceInvariants().catch(() => null),
      CommerceController.getMarketplaceRiskSignals().catch(() => []),
    ]);
    setReports(nextSearch?.reports ?? nextReports);
    setInvariants(nextInvariants);
    setRiskSignals(nextSearch?.riskSignals ?? nextSignals);
  };

  useEffect(() => {
    if (!currentUserPubky) {
      setIsLoading(false);
      return;
    }
    refresh()
      .catch(() => setError('This account does not have marketplace moderator access.'))
      .finally(() => setIsLoading(false));
  }, [currentUserPubky, query]);

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

  const flagRisk = async () => {
    if (!riskTargetId.trim()) {
      setError('Enter a listing, order, user, payment, or auction id to flag.');
      return;
    }
    try {
      const commandId = crypto.randomUUID();
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId,
        aggregateId: `risk:${commandId}`,
        expectedRevision: 0,
        issuedAt: new Date().toISOString(),
        kind: 'trust.flag_risk',
        payload: {
          signalType: riskType,
          targetType: riskTargetType,
          targetId: riskTargetId.trim(),
          details: `Sandbox risk review for ${riskType.replaceAll('_', ' ')}. Transaction history was not rewritten.`,
        },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setRiskTargetId('');
      await refresh();
    } catch {
      setError('Could not record this risk signal.');
    }
  };

  return {
    reports,
    isLoading,
    error,
    query,
    setQuery,
    invariants,
    riskSignals,
    riskTargetId,
    setRiskTargetId,
    riskTargetType,
    setRiskTargetType,
    riskType,
    setRiskType,
    flagRisk,
    decide,
    assign,
    reverse,
  };
}
