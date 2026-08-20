import { z } from 'zod';

export const relistMarketplaceListingSchema = z.object({
  price: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, 'Enter a valid USD amount with at most two decimal places.')
    .refine((value) => Number(value) > 0, 'Price must be greater than zero.'),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, 'Quantity must be a positive whole number.')
    .refine((value) => Number(value) <= 1_000_000, 'Quantity is too large.'),
});

export type RelistMarketplaceListingData = z.infer<typeof relistMarketplaceListingSchema>;

export const relistMarketplaceListingDefaults: RelistMarketplaceListingData = {
  price: '',
  quantity: '1',
};
