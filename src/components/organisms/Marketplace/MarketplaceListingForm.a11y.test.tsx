import { createRef } from 'react';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import {
  type CreateMarketplaceListingData,
  createMarketplaceListingDefaults,
} from '@/hooks/useCreateMarketplaceListing/useCreateMarketplaceListing.types';
import type { UseListingMediaPickerResult } from '@/hooks/useListingMediaPicker/useListingMediaPicker';
import { MarketplaceListingForm } from './MarketplaceListingForm';

const media: UseListingMediaPickerResult = {
  file: null,
  previewUrl: null,
  items: [],
  error: null,
  inputRef: createRef<HTMLInputElement>(),
  onInputChange: vi.fn(),
  choose: vi.fn(),
  remove: vi.fn(),
  removeAt: vi.fn(),
  moveUp: vi.fn(),
  moveDown: vi.fn(),
  setItemAltText: vi.fn(),
  reset: vi.fn(),
  prepare: vi.fn(),
  prepareGallery: vi.fn(),
};

function FormHarness() {
  const form = useForm<CreateMarketplaceListingData>({
    defaultValues: createMarketplaceListingDefaults,
  });
  return <MarketplaceListingForm form={form} media={media} onSubmit={vi.fn(async () => {})} isPublishing={false} />;
}

describe('MarketplaceListingForm accessibility', () => {
  it('has no serious or critical automated violations', async () => {
    const { container } = render(<FormHarness />);
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(blocking).toEqual([]);
  });
});
