'use client';

import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import { Button } from '@/atoms/Button/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/atoms/Dialog/Dialog';
import { useMarketplaceOffer } from '@/hooks/useMarketplaceOffer/useMarketplaceOffer';
import { useRequireAuth } from '@/hooks/useRequireAuth/useRequireAuth';
import { ControlledInputField } from '@/molecules/ControlledInputField/ControlledInputField';
import { ControlledTextareaField } from '@/molecules/ControlledTextareaField/ControlledTextareaField';

export function MarketplaceOfferDialog({
  aggregateId,
  expectedRevision,
  onAccepted,
  asSeller = false,
  label = 'Make offer',
  disabled = false,
}: {
  aggregateId: string;
  expectedRevision: number | null;
  onAccepted: () => void | Promise<void>;
  asSeller?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const offer = useMarketplaceOffer(aggregateId, expectedRevision, asSeller);
  const { requireAuth } = useRequireAuth();

  const submit = async () => {
    if (!(await offer.submit())) return;
    setOpen(false);
    offer.reset();
    await onAccepted();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false);
          return;
        }
        requireAuth(() => setOpen(true));
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1 rounded-full"
          disabled={disabled || expectedRevision === null}
        >
          <HandCoins className="mr-2 size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-popover">
        <DialogHeader>
          <DialogTitle>{asSeller ? 'Send a private offer' : 'Make a private offer'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {asSeller && (
            <ControlledInputField
              name="recipientPubky"
              control={offer.form.control}
              label="Watcher pubky"
              placeholder="Recipient public key"
            />
          )}
          <ControlledInputField
            name="amount"
            control={offer.form.control}
            label="Offer amount (USD)"
            placeholder="100.00"
          />
          <ControlledInputField name="quantity" control={offer.form.control} label="Quantity" placeholder="1" />
          <ControlledTextareaField
            name="message"
            control={offer.form.control}
            label="Message (optional)"
            placeholder="Add context for the seller"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={submit}>
            Send offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
