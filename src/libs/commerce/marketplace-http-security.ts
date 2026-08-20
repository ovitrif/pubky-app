export const MARKETPLACE_CSRF_HEADER = 'x-marketplace-csrf';
export const MARKETPLACE_CSRF_TOKEN = '1';

export const MARKETPLACE_JSON_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function marketplaceSecurityHeaders(mode: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': MARKETPLACE_JSON_CSP,
    'cache-control': 'no-store',
    'x-marketplace-mode': mode,
    ...extra,
  };
}

export function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function isAllowedMarketplaceOrigin(
  origin: string | undefined,
  referer: string | undefined,
  allowedOrigin: string,
): boolean {
  if (allowedOrigin === '*') return true;
  return (origin ?? originFromReferer(referer)) === allowedOrigin;
}

export function marketplaceMutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    [MARKETPLACE_CSRF_HEADER]: MARKETPLACE_CSRF_TOKEN,
    ...extra,
  };
}
