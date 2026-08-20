'use client';

import { Controller, useWatch } from 'react-hook-form';
import { Button } from '@/atoms/Button/Button';
import { Card, CardContent } from '@/atoms/Card/Card';
import { Checkbox } from '@/atoms/Checkbox/Checkbox';
import { Label } from '@/atoms/Label/Label';
import { Switch } from '@/atoms/Switch/Switch';
import { Typography } from '@/atoms/Typography/Typography';
import { COMMERCE_SHOP_MAX_COLLECTIONS } from '@/config/commerce';
import { useMarketplaceShopSettings } from '@/hooks/useMarketplaceShopSettings/useMarketplaceShopSettings';
import { ControlledInputField } from '@/molecules/ControlledInputField/ControlledInputField';
import { ControlledTextareaField } from '@/molecules/ControlledTextareaField/ControlledTextareaField';

export function MarketplaceShopSettingsForm() {
  const settings = useMarketplaceShopSettings();
  const collections = useWatch({ control: settings.form.control, name: 'collections' }) ?? [];

  return (
    <Card className="border">
      <CardContent className="grid gap-5 px-6">
        <div>
          <Typography as="h2" className="text-xl font-semibold">
            Shop policies
          </Typography>
          <Typography as="p" className="text-sm text-muted-foreground">
            Public owner-signed storefront settings · revision {settings.revision}
          </Typography>
        </div>
        <ControlledInputField name="name" control={settings.form.control} label="Shop name" />
        <ControlledTextareaField name="bio" control={settings.form.control} label="Shop bio" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ControlledInputField name="countryCode" control={settings.form.control} label="Country" />
          <ControlledInputField name="region" control={settings.form.control} label="Region" />
        </div>
        <ControlledTextareaField name="shippingPolicy" control={settings.form.control} label="Shipping policy" />
        <ControlledTextareaField name="returnPolicy" control={settings.form.control} label="Return policy" />
        <Controller
          name="vacationMode"
          control={settings.form.control}
          render={({ field }) => (
            <Label className="justify-between">
              Vacation mode
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Vacation mode" />
            </Label>
          )}
        />
        <ControlledTextareaField
          name="blockedBuyers"
          control={settings.form.control}
          label="Blocked buyers"
          placeholder="One Pubky per line. Blocked buyers cannot check out with this shop."
          rows={4}
        />
        <div className="grid gap-3 rounded-xl border p-4">
          <div>
            <Typography as="h3" className="font-semibold">
              Shop collections
            </Typography>
            <Typography as="p" className="text-sm text-muted-foreground">
              Featured groups on your public shop. Up to {COMMERCE_SHOP_MAX_COLLECTIONS} collections.
            </Typography>
          </div>
          {collections.map((collection, index) => (
            <div key={collection.id} className="grid gap-3 rounded-lg border p-3">
              <ControlledInputField
                name={`collections.${index}.name`}
                control={settings.form.control}
                label="Collection name"
              />
              {settings.sellerListings.length ? (
                <div className="grid gap-2">
                  <Typography as="p" className="text-sm font-medium">
                    Listings
                  </Typography>
                  {settings.sellerListings.map((listing) => {
                    const checked = collection.listingIds.includes(listing.listingId);
                    return (
                      <Label key={listing.listingId} className="justify-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            const listingIds = next
                              ? [...new Set([...collection.listingIds, listing.listingId])]
                              : collection.listingIds.filter((id) => id !== listing.listingId);
                            settings.form.setValue(`collections.${index}.listingIds`, listingIds, {
                              shouldDirty: true,
                            });
                          }}
                          aria-label={`Include ${listing.title} in ${collection.name || 'collection'}`}
                        />
                        {listing.title}
                      </Label>
                    );
                  })}
                </div>
              ) : (
                <Typography as="p" className="text-sm text-muted-foreground">
                  Publish listings to add them to a collection.
                </Typography>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-fit rounded-full"
                onClick={() => {
                  settings.form.setValue(
                    'collections',
                    collections.filter((_, collectionIndex) => collectionIndex !== index),
                    { shouldDirty: true },
                  );
                }}
              >
                Remove collection
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="w-fit rounded-full"
            disabled={collections.length >= COMMERCE_SHOP_MAX_COLLECTIONS}
            onClick={() => {
              settings.form.setValue(
                'collections',
                [
                  ...collections,
                  {
                    id: `collection_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
                    name: 'Featured',
                    listingIds: [],
                  },
                ],
                { shouldDirty: true },
              );
            }}
          >
            Add collection
          </Button>
        </div>
        <Button className="w-full rounded-full" onClick={() => void settings.submit()}>
          Save shop settings
        </Button>
        <div className="grid gap-3 rounded-xl border p-4">
          <Typography as="h3" className="font-semibold">
            Privacy
          </Typography>
          <Typography as="p" className="text-sm text-muted-foreground">
            Export redacts delivery lines. Deleting local data keeps public shop records and signed transaction history.
          </Typography>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="rounded-full" onClick={() => void settings.exportAccount()}>
              Export account
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => void settings.deleteLocalData()}>
              Delete local marketplace data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
