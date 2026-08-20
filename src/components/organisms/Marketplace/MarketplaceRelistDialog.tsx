'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/atoms/Button/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/atoms/Dialog/Dialog';
import { useRelistMarketplaceListing } from '@/hooks/useRelistMarketplaceListing/useRelistMarketplaceListing';
import type { CommerceListingRecord } from '@/libs/commerce/marketplace-records';
import { ControlledInputField } from '@/molecules/ControlledInputField/ControlledInputField';

export function MarketplaceRelistDialog({
  record,
  defaultPrice,
}: {
  record: CommerceListingRecord;
  defaultPrice: string;
}) {
  const [open, setOpen] = useState(false);
  const relist = useRelistMarketplaceListing();

  const begin = () => {
    relist.form.reset({
      price: defaultPrice,
      quantity: String(record.variants[0]?.quantity || 1),
    });
    setOpen(true);
  };

  const submit = async () => {
    if (await relist.submit(record)) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={begin}>
          <RotateCcw className="mr-2 size-4" />
          Relist
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-popover">
        <DialogHeader>
          <DialogTitle>Relist {record.title}</DialogTitle>
        </DialogHeader>
        <ControlledInputField name="price" control={relist.form.control} label="Price (USD)" />
        <ControlledInputField name="quantity" control={relist.form.control} label="Quantity" />
        <DialogFooter>
          <Button variant="secondary" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={submit}>
            Relist as active
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
