import { describe, expect, it } from 'vitest';
import { buildAppContentSecurityPolicy } from './content-security-policy';

describe('buildAppContentSecurityPolicy', () => {
  it('emits an enforcing nonce policy and keeps Turbopack eval in development only', () => {
    const development = buildAppContentSecurityPolicy({ nonce: 'dev-nonce', isDevelopment: true });
    const production = buildAppContentSecurityPolicy({ nonce: 'prod-nonce', isDevelopment: false });

    expect(development).toContain(
      "script-src 'self' 'nonce-dev-nonce' 'strict-dynamic' 'wasm-unsafe-eval' 'unsafe-eval'",
    );
    expect(production).toContain("script-src 'self' 'nonce-prod-nonce' 'strict-dynamic' 'wasm-unsafe-eval'");
    expect(production).not.toContain("'unsafe-eval'");
    expect(production).toContain("connect-src 'self' https: wss: http://127.0.0.1:3100");
    expect(production).toContain("default-src 'self'");
    expect(production).not.toContain('Report-Only');
  });
});
