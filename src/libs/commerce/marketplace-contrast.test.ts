import { describe, expect, it } from 'vitest';

/** WCAG 2 relative luminance for an sRGB hex color. */
function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Approximate sRGB of marketplace surfaces. `--card` is oklch(0.232 0.006 285.946)
 * (~#3a3940). `--background` is oklch(0.118 0.014 284.115) (~#1d1b22).
 * The marketplace route layout overrides `--muted-foreground` to #b4b4bb so body
 * copy on cards meets WCAG AA 4.5:1 without changing global social-app tokens.
 */
const MARKETPLACE_MUTED = '#b4b4bb';
const CARD = '#3a3940';
const BACKGROUND = '#1d1b22';
const GLOBAL_MUTED = '#89898f';

describe('marketplace contrast tokens', () => {
  it('keeps marketplace muted text at least 4.5:1 on card and page backgrounds', () => {
    expect(contrastRatio(MARKETPLACE_MUTED, CARD)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(MARKETPLACE_MUTED, BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it('records that the global muted token is below AA on cards', () => {
    expect(contrastRatio(GLOBAL_MUTED, CARD)).toBeLessThan(4.5);
    expect(contrastRatio(GLOBAL_MUTED, BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });
});
