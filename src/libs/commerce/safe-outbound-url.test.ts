import { describe, expect, it } from 'vitest';
import { isLoopbackCommerceHostname, isSafeCommerceServiceUrl } from './safe-outbound-url';

describe('isLoopbackCommerceHostname', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST'])('treats %s as loopback', (hostname) => {
    expect(isLoopbackCommerceHostname(hostname)).toBe(true);
  });

  it.each(['locks.example.com', '169.254.169.254'])('rejects %s', (hostname) => {
    expect(isLoopbackCommerceHostname(hostname)).toBe(false);
  });
});

describe('isSafeCommerceServiceUrl', () => {
  it.each([
    ['http://localhost:3100'],
    ['http://127.0.0.1:3101'],
    ['http://[::1]:3102'],
    ['https://locks.example.com'],
    ['https://marketplace.pubky.app/v1'],
  ])('allows %s', (url) => {
    expect(isSafeCommerceServiceUrl(url)).toBe(true);
  });

  it.each([
    ['http://169.254.169.254/latest/meta-data'],
    ['https://169.254.169.254'],
    ['http://10.0.0.8'],
    ['https://192.168.1.10'],
    ['http://172.16.0.2'],
    ['https://metadata.google.internal'],
    ['file:///etc/passwd'],
    ['javascript:alert(1)'],
    ['data:text/html,hi'],
    ['https://user:secret@example.com'],
    ['http://example.com'],
    ['https://intranet.local'],
    ['not-a-url'],
  ])('rejects %s', (url) => {
    expect(isSafeCommerceServiceUrl(url)).toBe(false);
  });
});
