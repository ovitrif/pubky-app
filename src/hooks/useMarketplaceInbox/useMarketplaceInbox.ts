'use client';

import { useEffect, useState } from 'react';
import { getCommercePollIntervalMs } from '@/config/commerce';
import { CommerceController } from '@/controllers/commerce/commerce';
import { toast } from '@/molecules/Toaster/use-toast';
import type { MarketplaceConversation } from '@/services/marketplace/marketplace';
import { useAuthStore } from '@/stores/auth/auth.store';

export function useMarketplaceInbox() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const [conversations, setConversations] = useState<MarketplaceConversation[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(currentUserPubky));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!currentUserPubky) return;
    const next = await CommerceController.getMarketplaceConversations();
    setConversations(next);
    setError(null);
  };

  useEffect(() => {
    if (!currentUserPubky) {
      setIsLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const next = await CommerceController.getMarketplaceConversations();
        if (!active) return;
        setConversations(next);
        setError(null);
      } catch {
        if (active) setError('Marketplace messages are unavailable.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (active) void load();
    }, getCommercePollIntervalMs());
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUserPubky]);

  const block = async (conversation: MarketplaceConversation): Promise<boolean> => {
    if (!currentUserPubky) return false;
    const peerPubky =
      currentUserPubky === conversation.sellerPubky ? conversation.buyerPubky : conversation.sellerPubky;
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId: conversation.id,
        expectedRevision: conversation.revision,
        issuedAt: new Date().toISOString(),
        kind: 'message.block',
        payload: {
          listingAggregateId: conversation.listingAggregateId,
          peerPubky,
        },
      });
      if (!response.ok) {
        toast({ variant: 'error', description: response.error.message });
        return false;
      }
      toast({ title: 'Conversation blocked' });
      await refresh();
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not block this conversation.' });
      return false;
    }
  };

  return { conversations, isLoading, error, block };
}
