import { describe, expect, it } from 'vitest';
import {
  isAllowedMarketplaceOrigin,
  MARKETPLACE_CSRF_HEADER,
  MARKETPLACE_JSON_CSP,
  marketplaceMutationHeaders,
  marketplaceSecurityHeaders,
  originFromReferer,
} from './marketplace-http-security';

describe('marketplace HTTP security', () => {
  it('labels JSON responses as non-executable and non-cacheable', () => {
    expect(marketplaceSecurityHeaders('sandbox')).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'content-security-policy': MARKETPLACE_JSON_CSP,
      'cache-control': 'no-store',
      'x-marketplace-mode': 'sandbox',
    });
    expect(MARKETPLACE_JSON_CSP).toContain("default-src 'none'");
  });

  it('requires an exact origin when CORS is not wildcard', () => {
    expect(isAllowedMarketplaceOrigin('http://localhost:3000', undefined, '*')).toBe(true);
    expect(isAllowedMarketplaceOrigin('http://evil.test', undefined, 'http://localhost:3000')).toBe(false);
    expect(isAllowedMarketplaceOrigin('http://localhost:3000', undefined, 'http://localhost:3000')).toBe(true);
    expect(isAllowedMarketplaceOrigin(undefined, 'http://localhost:3000/marketplace', 'http://localhost:3000')).toBe(
      true,
    );
    expect(originFromReferer('not-a-url')).toBeUndefined();
  });

  it('exposes a custom CSRF header that simple form posts cannot set', () => {
    expect(marketplaceMutationHeaders({ 'content-type': 'application/json' })).toMatchObject({
      [MARKETPLACE_CSRF_HEADER]: '1',
      'content-type': 'application/json',
    });
  });
});
