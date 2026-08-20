'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { CommerceController } from '@/controllers/commerce/commerce';
import type { CommerceListingRecord } from '@/libs/commerce/marketplace-records';
import { toast } from '@/molecules/Toaster/use-toast';
import {
  type RelistMarketplaceListingData,
  relistMarketplaceListingDefaults,
  relistMarketplaceListingSchema,
} from './useRelistMarketplaceListing.types';

export interface UseRelistMarketplaceListingResult {
  form: UseFormReturn<RelistMarketplaceListingData>;
  submit: (record: CommerceListingRecord) => Promise<string | null>;
}

export function useRelistMarketplaceListing(): UseRelistMarketplaceListingResult {
  const form = useForm<RelistMarketplaceListingData>({
    resolver: zodResolver(relistMarketplaceListingSchema),
    defaultValues: relistMarketplaceListingDefaults,
    mode: 'onChange',
  });

  const submit = async (record: CommerceListingRecord): Promise<string | null> => {
    let createdId: string | null = null;
    await form.handleSubmit(async (data) => {
      const now = new Date().toISOString();
      const nextId = crypto.randomUUID().replaceAll('-', '');
      const amountMinor = Math.round(Number(data.price) * 100);
      const sale =
        record.sale.format === 'auction'
          ? { ...record.sale, startingPrice: { ...record.sale.startingPrice, amountMinor } }
          : { ...record.sale, unitPrice: { ...record.sale.unitPrice, amountMinor } };
      try {
        await CommerceController.commitUpsertListing({
          ...record,
          listingId: nextId,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          state: 'active',
          sale,
          variants: record.variants.map((variant) => ({
            ...variant,
            quantity: Number(data.quantity),
            enabled: true,
          })),
        });
        createdId = `${record.ownerPubky}:${nextId}`;
        toast({ title: 'Listing relisted', description: 'A new active listing was created from this inventory.' });
      } catch {
        toast({ variant: 'error', description: 'Could not relist this item.' });
      }
    })();
    return createdId;
  };

  return { form, submit };
}
