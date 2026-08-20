import { checkDnsSafety } from '@/core/services/nextjs/nextjs.utils';
import { ValidationErrorCode } from '@/libs/error/error.codes';
import { Err } from '@/libs/error/error.factories';
import { ErrorService } from '@/libs/error/error.types';
import { isLoopbackCommerceHostname, isSafeCommerceServiceUrl } from './safe-outbound-url';

/**
 * Node-only resolved-URL check. Browser clients keep the sync hostname allowlist
 * in `isSafeCommerceServiceUrl` — they cannot safely resolve DNS.
 *
 * Loopback sandbox hosts are allowed without DNS because `checkDnsSafety` treats
 * 127.0.0.1 as unsafe (correct for user-content fetches). A public hostname that
 * later resolves to loopback or link-local is rejected (DNS rebinding).
 *
 * Do not import this module from client bundles.
 */
export async function assertSafeResolvedCommerceServiceUrl(
  value: string,
  operation = 'assertSafeResolvedCommerceServiceUrl',
): Promise<URL> {
  if (!isSafeCommerceServiceUrl(value)) {
    throw Err.validation(ValidationErrorCode.INVALID_INPUT, 'Commerce service URL is not allowed.', {
      service: ErrorService.Marketplace,
      operation,
      context: { scheme: 'blocked' },
    });
  }

  const parsed = new URL(value);
  if (isLoopbackCommerceHostname(parsed.hostname)) {
    return parsed;
  }

  const dns = await checkDnsSafety(parsed.hostname);
  if (!dns.ok) {
    throw Err.validation(ValidationErrorCode.INVALID_INPUT, 'Commerce service URL resolved to an unsafe address.', {
      service: ErrorService.Marketplace,
      operation,
      context: { reason: dns.reason },
    });
  }

  return parsed;
}

export async function assertSafeResolvedCommerceServiceUrls(
  values: string[],
  operation = 'assertSafeResolvedCommerceServiceUrls',
): Promise<void> {
  await Promise.all(values.map((value) => assertSafeResolvedCommerceServiceUrl(value, operation)));
}
