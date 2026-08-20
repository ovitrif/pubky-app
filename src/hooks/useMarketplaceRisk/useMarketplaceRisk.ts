'use client';

import { useEffect, useState } from 'react';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useMarketplaceStaffPage } from '@/hooks/useMarketplaceStaffPage/useMarketplaceStaffPage';
import type { MarketplaceEnforcement, MarketplaceRiskSignal } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export function useMarketplaceRisk() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const staff = useMarketplaceStaffPage('risk');
  const [signals, setSignals] = useState<MarketplaceRiskSignal[]>([]);
  const [holds, setHolds] = useState<MarketplaceEnforcement[]>([]);
  const [riskTargetId, setRiskTargetId] = useState('');
  const [riskTargetType, setRiskTargetType] = useState<MarketplaceRiskSignal['targetType']>('order');
  const [riskType, setRiskType] = useState<MarketplaceRiskSignal['signalType']>('payment_abuse');
  const [subjectPubky, setSubjectPubky] = useState('');
  const [notes, setNotes] = useState('Sandbox risk review. Transaction history was not rewritten.');
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!currentUserPubky) return;
    const [nextSignals, nextHolds] = await Promise.all([
      CommerceController.getMarketplaceRiskSignals(),
      CommerceController.getMarketplaceEnforcements(),
    ]);
    setSignals(nextSignals);
    setHolds(nextHolds);
  };

  useEffect(() => {
    if (!currentUserPubky || !staff.ready) {
      setIsLoading(Boolean(currentUserPubky) && !staff.ready);
      return;
    }
    refresh()
      .catch(() => setError('This account does not have marketplace risk access.'))
      .finally(() => setIsLoading(false));
  }, [currentUserPubky, staff.ready]);

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
          details: notes.trim() || `Sandbox risk review for ${riskType.replaceAll('_', ' ')}.`,
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

  const hold = async () => {
    if (subjectPubky.trim().length !== 52) {
      setError('Enter the 52-character subject pubky to hold.');
      return;
    }
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `enforcement:${subjectPubky.trim()}`,
        expectedRevision: holds.some((item) => item.subjectPubky === subjectPubky.trim()) ? 1 : 0,
        issuedAt: new Date().toISOString(),
        kind: 'risk.hold',
        payload: { subjectPubky: subjectPubky.trim(), notes: notes.trim() },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      await refresh();
    } catch {
      setError('Could not apply this transaction hold.');
    }
  };

  const release = async (subject: string) => {
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: `enforcement:${subject}`,
        expectedRevision: 1,
        issuedAt: new Date().toISOString(),
        kind: 'risk.release',
        payload: { subjectPubky: subject, notes: notes.trim() || 'Released after review.' },
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      await refresh();
    } catch {
      setError('Could not release this transaction hold.');
    }
  };

  return {
    signals,
    holds,
    riskTargetId,
    setRiskTargetId,
    riskTargetType,
    setRiskTargetType,
    riskType,
    setRiskType,
    subjectPubky,
    setSubjectPubky,
    notes,
    setNotes,
    isLoading,
    error,
    flagRisk,
    hold,
    release,
    isOperator: staff.isOperator,
  };
}
