import { describe, expect, it } from 'vitest';
import { isDisplayableCommerceMediaUrl } from './media';

describe('isDisplayableCommerceMediaUrl', () => {
  it('accepts browser-displayable URLs and rejects Pubky homeserver URIs', () => {
    expect(isDisplayableCommerceMediaUrl('https://cdn.example/boots.jpg')).toBe(true);
    expect(isDisplayableCommerceMediaUrl('blob:https://localhost/1')).toBe(true);
    expect(isDisplayableCommerceMediaUrl('data:image/png;base64,abc')).toBe(true);
    expect(
      isDisplayableCommerceMediaUrl('pubky://yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy/pub/media'),
    ).toBe(false);
  });
});
