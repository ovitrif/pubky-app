'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/atoms/Button/Button';
import { Typography } from '@/atoms/Typography/Typography';

export function MarketplaceQuantityStepper({
  value,
  min = 1,
  max,
  label,
  onChange,
}: {
  value: number;
  min?: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        type="button"
        aria-label={`Decrease ${label} quantity`}
        disabled={value <= min || max < min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" />
      </Button>
      <Typography as="span" className="min-w-8 text-center" aria-live="polite">
        {value}
      </Typography>
      <Button
        size="icon"
        variant="ghost"
        type="button"
        aria-label={`Increase ${label} quantity`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
