import { z } from 'zod';
import {
  COMMERCE_SHOP_BIO_MAX_CHARS,
  COMMERCE_SHOP_COLLECTION_MAX_LISTINGS,
  COMMERCE_SHOP_COLLECTION_NAME_MAX_CHARS,
  COMMERCE_SHOP_MAX_COLLECTIONS,
  COMMERCE_SHOP_NAME_MAX_CHARS,
  COMMERCE_SHOP_POLICY_MAX_CHARS,
} from '@/config/commerce';

export const marketplaceShopCollectionFormSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Collection id is required.')
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use a path-safe collection id.'),
  name: z.string().trim().min(1, 'Collection name is required.').max(COMMERCE_SHOP_COLLECTION_NAME_MAX_CHARS),
  listingIds: z.array(z.string().trim().min(1)).max(COMMERCE_SHOP_COLLECTION_MAX_LISTINGS),
});

export const marketplaceShopSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Shop name is required.').max(COMMERCE_SHOP_NAME_MAX_CHARS),
  bio: z.string().trim().max(COMMERCE_SHOP_BIO_MAX_CHARS),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code.'),
  region: z.string().trim().max(100),
  shippingPolicy: z.string().trim().min(1, 'Shipping policy is required.').max(COMMERCE_SHOP_POLICY_MAX_CHARS),
  returnPolicy: z.string().trim().min(1, 'Return policy is required.').max(COMMERCE_SHOP_POLICY_MAX_CHARS),
  vacationMode: z.boolean(),
  blockedBuyers: z.string().trim().max(4_000),
  collections: z.array(marketplaceShopCollectionFormSchema).max(COMMERCE_SHOP_MAX_COLLECTIONS),
});

export type MarketplaceShopSettingsData = z.infer<typeof marketplaceShopSettingsSchema>;

export const marketplaceShopSettingsDefaults: MarketplaceShopSettingsData = {
  name: '',
  bio: '',
  countryCode: 'US',
  region: '',
  shippingPolicy: 'Ships within three business days.',
  returnPolicy: 'Returns accepted within 30 days unless marked final sale.',
  vacationMode: false,
  blockedBuyers: '',
  collections: [],
};
