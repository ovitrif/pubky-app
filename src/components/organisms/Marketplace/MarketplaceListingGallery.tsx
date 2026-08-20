'use client';

import { useState } from 'react';
import { Gavel, PackageCheck } from 'lucide-react';
import { Badge } from '@/atoms/Badge/Badge';
import { Button } from '@/atoms/Button/Button';
import { Typography } from '@/atoms/Typography/Typography';
import { isDisplayableCommerceMediaUrl } from '@/libs/commerce/media';
import type { CommerceListingRecord } from '@/libs/commerce/marketplace-records';
import { cn } from '@/libs/utils/utils';

const MEDIA_BACKGROUNDS = [
  'from-brand/45 via-purple-500/20 to-background',
  'from-cyan-500/40 via-blue-500/20 to-background',
  'from-amber-500/45 via-orange-500/20 to-background',
  'from-emerald-500/40 via-teal-500/20 to-background',
  'from-rose-500/40 via-pink-500/20 to-background',
  'from-slate-400/35 via-zinc-500/20 to-background',
] as const;

export function MarketplaceListingGallery({
  media,
  saleFormat,
}: {
  media: CommerceListingRecord['media'];
  saleFormat: CommerceListingRecord['sale']['format'];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = media[selectedIndex] ?? media[0];
  const displayable = selected ? isDisplayableCommerceMediaUrl(selected.url) : false;
  const colorIndex =
    Number.parseInt(selected?.contentHash.charAt(0) ?? String(selectedIndex), 16) % MEDIA_BACKGROUNDS.length;
  const background = MEDIA_BACKGROUNDS[colorIndex] ?? MEDIA_BACKGROUNDS[0];

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'relative flex min-h-[440px] items-center justify-center overflow-hidden rounded-2xl border bg-linear-to-br lg:min-h-[640px]',
          background,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.18),transparent_32%)]" />
        {displayable && selected ? (
          <img src={selected.url} alt={selected.altText} className="relative z-10 max-h-[640px] w-full object-cover" />
        ) : saleFormat === 'auction' ? (
          <Gavel className="size-32 text-foreground/75 drop-shadow-2xl" />
        ) : (
          <PackageCheck className="size-32 text-foreground/75 drop-shadow-2xl" />
        )}
        <Badge className="absolute top-4 left-4 bg-background/85 text-foreground backdrop-blur-md">
          {saleFormat === 'auction' ? 'Live auction' : 'Buy now'}
        </Badge>
        {media.length > 1 && (
          <Badge variant="secondary" className="absolute top-4 right-4 bg-background/85 backdrop-blur-md">
            {selectedIndex + 1} of {media.length}
          </Badge>
        )}
      </div>
      {selected && (
        <Typography as="p" className="text-sm text-muted-foreground">
          {selected.altText}
        </Typography>
      )}
      {media.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Listing photos">
          {media.map((item, index) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={index === selectedIndex ? 'default' : 'secondary'}
              className="rounded-full"
              aria-selected={index === selectedIndex}
              role="tab"
              onClick={() => setSelectedIndex(index)}
            >
              {index === 0 ? 'Cover' : `Photo ${index + 1}`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
