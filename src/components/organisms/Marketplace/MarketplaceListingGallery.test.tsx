import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CommerceListingRecord } from '@/libs/commerce/marketplace-records';
import { MarketplaceListingGallery } from './MarketplaceListingGallery';

const media = [
  {
    id: 'image_01',
    type: 'image',
    url: 'https://cdn.example/cover.jpg',
    contentHash: 'a'.repeat(64),
    mimeType: 'image/jpeg',
    byteSize: 10,
    width: 1200,
    height: 1600,
    altText: 'Brown leather boots',
  },
  {
    id: 'image_02',
    type: 'image',
    url: 'https://cdn.example/side.jpg',
    contentHash: 'b'.repeat(64),
    mimeType: 'image/jpeg',
    byteSize: 10,
    width: 1200,
    height: 1600,
    altText: 'Side profile of the boots',
  },
] as CommerceListingRecord['media'];

describe('MarketplaceListingGallery', () => {
  it('shows captions and switches selected photos', async () => {
    const user = userEvent.setup();
    render(<MarketplaceListingGallery media={media} saleFormat="fixed_price" />);

    expect(screen.getByAltText('Brown leather boots')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Photo 2' }));
    expect(screen.getByAltText('Side profile of the boots')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });
});
