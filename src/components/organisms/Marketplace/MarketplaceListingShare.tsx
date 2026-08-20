'use client';

import { Share2 } from 'lucide-react';
import { Button } from '@/atoms/Button/Button';
import { toast } from '@/molecules/Toaster/use-toast';

export function MarketplaceListingShare({ title }: { title: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied', description: title });
    } catch {
      toast({ variant: 'error', description: 'Could not copy this listing link.' });
    }
  };

  return (
    <Button size="sm" variant="secondary" className="rounded-full" onClick={copy} aria-label={`Copy link to ${title}`}>
      <Share2 className="mr-2 size-4" />
      Share
    </Button>
  );
}
