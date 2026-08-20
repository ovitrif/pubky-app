'use client';

import { CommerceController } from '@/controllers/commerce/commerce';
import { toast } from '@/molecules/Toaster/use-toast';

export function useMarketplaceCloseAuction(aggregateId: string, expectedRevision: number | null) {
  const submit = async (): Promise<boolean> => {
    if (expectedRevision === null) return false;
    try {
      const response = await CommerceController.executeMarketplaceCommand({
        version: 1,
        commandId: crypto.randomUUID(),
        aggregateId,
        expectedRevision,
        issuedAt: new Date().toISOString(),
        kind: 'auction.close',
        payload: {},
      });
      if (!response.ok) {
        toast({ variant: 'error', description: response.error.message });
        return false;
      }
      toast({
        title: 'Auction closed',
        description: 'A winning order was created when reserve was met. Confirm delivery in Orders.',
      });
      return true;
    } catch {
      toast({ variant: 'error', description: 'Could not close this auction.' });
      return false;
    }
  };

  return { submit };
}
