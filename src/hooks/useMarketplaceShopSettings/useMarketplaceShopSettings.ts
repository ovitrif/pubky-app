'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { COMMERCE_CONTRACT_VERSION } from '@/config/commerce';
import { CommerceController } from '@/controllers/commerce/commerce';
import { buildMarketplaceBlockedBuyersAggregateId } from '@/libs/commerce/transaction-commands';
import { commercePubkySchema } from '@/libs/commerce/transaction-contracts';
import { toast } from '@/molecules/Toaster/use-toast';
import { useAuthStore } from '@/stores/auth/auth.store';
import {
  type MarketplaceShopSettingsData,
  marketplaceShopSettingsDefaults,
  marketplaceShopSettingsSchema,
} from './useMarketplaceShopSettings.types';

export function useMarketplaceShopSettings() {
  const currentUserPubky = useAuthStore((state) => state.currentUserPubky);
  const [revision, setRevision] = useState(0);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const form = useForm<MarketplaceShopSettingsData>({
    resolver: zodResolver(marketplaceShopSettingsSchema),
    defaultValues: marketplaceShopSettingsDefaults,
    mode: 'onChange',
  });

  useEffect(() => {
    if (!currentUserPubky) return;
    Promise.all([CommerceController.getShop(currentUserPubky), CommerceController.getBlockedBuyers().catch(() => [])])
      .then(([shop, blocked]) => {
        if (shop) {
          setRevision(shop.record.revision);
          setCreatedAt(shop.record.createdAt);
          form.reset({
            name: shop.record.name,
            bio: shop.record.bio,
            countryCode: shop.record.location.countryCode,
            region: shop.record.location.region ?? '',
            shippingPolicy: shop.record.shippingPolicy,
            returnPolicy: shop.record.returnPolicy,
            vacationMode: shop.record.vacationMode,
            blockedBuyers: blocked.join('\n'),
          });
          return;
        }
        form.setValue('blockedBuyers', blocked.join('\n'));
      })
      .catch(() => {});
  }, [currentUserPubky, form]);

  const submit = async () => {
    if (!currentUserPubky) return false;
    let succeeded = false;
    await form.handleSubmit(async (data) => {
      const now = new Date().toISOString();
      try {
        await CommerceController.commitUpsertShop({
          schemaVersion: COMMERCE_CONTRACT_VERSION,
          recordType: 'shop',
          ownerPubky: currentUserPubky,
          revision: revision + 1,
          createdAt: createdAt ?? now,
          updatedAt: now,
          name: data.name,
          bio: data.bio,
          location: { countryCode: data.countryCode.toUpperCase(), region: data.region || undefined },
          shippingPolicy: data.shippingPolicy,
          returnPolicy: data.returnPolicy,
          vacationMode: data.vacationMode,
        });
        const requested = [
          ...new Set(
            data.blockedBuyers
              .split(/[\s,]+/)
              .map((value) => value.trim())
              .filter((value) => commercePubkySchema.safeParse(value).success),
          ),
        ];
        const currentBlocked: string[] = await CommerceController.getBlockedBuyers().catch(() => []);
        const aggregateId = buildMarketplaceBlockedBuyersAggregateId(currentUserPubky);
        await Promise.all([
          ...requested
            .filter((buyer) => !currentBlocked.includes(buyer))
            .map((buyerPubky) =>
              CommerceController.executeMarketplaceCommand({
                version: 1,
                commandId: crypto.randomUUID(),
                aggregateId,
                expectedRevision: 0,
                issuedAt: now,
                kind: 'buyer.block',
                payload: { buyerPubky },
              }),
            ),
          ...currentBlocked
            .filter((buyer) => !requested.includes(buyer))
            .map((buyerPubky) =>
              CommerceController.executeMarketplaceCommand({
                version: 1,
                commandId: crypto.randomUUID(),
                aggregateId,
                expectedRevision: 0,
                issuedAt: now,
                kind: 'buyer.unblock',
                payload: { buyerPubky },
              }),
            ),
        ]);
        setRevision((current) => current + 1);
        setCreatedAt((current) => current ?? now);
        succeeded = true;
        toast({ title: 'Shop settings saved' });
      } catch {
        toast({ variant: 'error', description: 'Could not save shop settings.' });
      }
    })();
    return succeeded;
  };

  return { form, revision, submit };
}
