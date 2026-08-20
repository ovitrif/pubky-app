'use client';

import { CommerceController } from '@/controllers/commerce/commerce';
import { toast } from '@/molecules/Toaster/use-toast';

export function useMarketplaceBuyNow(aggregateId: string, expectedRevision: number | null) {
  const submit = async (): Promise<boolean> => {
    if (expectedRevision === null) return false;
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId,
        expectedRevision,
        issuedAt: new Date().toISOString(),
        kind: 'auction.buy_now',
        payload: {},
      });
      if (!response.ok) {
        toast({ variant: 'error', description: response.error.message });
        return false;
      }
      toast({ title: 'Buy now accepted', description: 'The auction closed at the buy-now price.' });
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not complete buy-now.' });
      return false;
    }
  };

  return { submit };
}
