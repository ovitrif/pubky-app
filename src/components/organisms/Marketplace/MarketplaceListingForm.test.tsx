import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function FormHarness({
  fulfillment = 'physical',
  onSubmit = vi.fn(),
}: {
  fulfillment?: CreateMarketplaceListingData['fulfillment'];
  onSubmit?: () => Promise<void>;
}) {
  const form = useForm<CreateMarketplaceListingData>({
    defaultValues: { ...createMarketplaceListingDefaults, fulfillment },
  });
  return <MarketplaceListingForm form={form} media={media} onSubmit={onSubmit} isPublishing={false} />;
}

describe('MarketplaceListingForm', () => {
  it('renders the complete physical listing contract', () => {
    render(<FormHarness />);

    expect(screen.getByRole('heading', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Item details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Price and availability' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delivery and returns' })).toBeInTheDocument();
    expect(screen.getByText('Flat shipping (USD)')).toBeInTheDocument();
    expect(screen.getByText('Weight (grams)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish listing' })).toBeInTheDocument();
  });

  it('hides package fields for pickup listings', () => {
    render(<FormHarness fulfillment="pickup" />);

    expect(screen.queryByText('Flat shipping (USD)')).not.toBeInTheDocument();
    expect(screen.queryByText('Weight (grams)')).not.toBeInTheDocument();
  });

  it('reorders and captions gallery photos', async () => {
    const user = userEvent.setup();
    const galleryMedia: UseListingMediaPickerResult = {
      ...media,
      items: [
        {
          id: 'photo_1',
          file: new File(['a'], 'cover.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:cover',
          altText: 'Cover',
        },
        {
          id: 'photo_2',
          file: new File(['b'], 'side.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:side',
          altText: 'Side',
        },
      ],
    };
    function GalleryHarness() {
      const form = useForm<CreateMarketplaceListingData>({
        defaultValues: { ...createMarketplaceListingDefaults, fulfillment: 'pickup' },
      });
      return (
        <MarketplaceListingForm
          form={form}
          media={galleryMedia}
          onSubmit={vi.fn(async () => {})}
          isPublishing={false}
        />
      );
    }
    render(<GalleryHarness />);

    expect(screen.getByText('Cover photo')).toBeInTheDocument();
    expect(screen.getByText('Photo 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move photo 2 up' }));
    expect(galleryMedia.moveUp).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Add another photo' }));
    expect(galleryMedia.choose).toHaveBeenCalled();
  });

  it('opens the dedicated image picker and submits through the form owner', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    render(<FormHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Add image' }));
    await user.click(screen.getByRole('button', { name: 'Publish listing' }));

    expect(media.choose).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('adds and removes inventory variants', async () => {
    const user = userEvent.setup();
    render(<FormHarness fulfillment="pickup" />);

    await user.click(screen.getByRole('button', { name: 'Add variant' }));
    expect(screen.getAllByText('Seller SKU')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remove variant 2' }));
    expect(screen.getAllByText('Seller SKU')).toHaveLength(1);
  });
});

describe('MarketplaceListingForm - Snapshots', () => {
  it('matches the physical listing form snapshot', () => {
    const { container } = render(<FormHarness />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
