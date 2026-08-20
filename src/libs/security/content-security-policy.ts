/**
 * Enforced Next.js document CSP. The runtime-config payload stays a raw <script>
 * (ADR 0017) and must carry the same per-request nonce this policy emits.
 *
 * `connect-src` allows all HTTPS/WSS plus the labeled localhost marketplace ports.
 * Script execution is nonce-gated; host allowlists are not a substitute for that.
 */

const SANDBOX_CONNECT_SRC = [
  'http://127.0.0.1:3100',
  'http://localhost:3100',
  'http://127.0.0.1:3101',
  'http://localhost:3101',
  'http://127.0.0.1:3102',
  'http://localhost:3102',
] as const;

export function buildAppContentSecurityPolicy({
  nonce,
  isDevelopment,
}: {
  nonce: string;
  isDevelopment: boolean;
}): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'wasm-unsafe-eval'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    `connect-src 'self' https: wss: ${SANDBOX_CONNECT_SRC.join(' ')}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: https:",
    "frame-src 'self' https:",
  ].join('; ');
}
