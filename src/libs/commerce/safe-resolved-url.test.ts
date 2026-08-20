import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSafeResolvedCommerceServiceUrl } from './safe-resolved-url';

const { mockCheckDnsSafety } = vi.hoisted(() => ({
  mockCheckDnsSafety: vi.fn(),
}));

vi.mock('@/core/services/nextjs/nextjs.utils', () => ({
  checkDnsSafety: mockCheckDnsSafety,
}));

describe('assertSafeResolvedCommerceServiceUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows loopback sandbox URLs without resolving DNS', async () => {
    await expect(assertSafeResolvedCommerceServiceUrl('http://127.0.0.1:3100')).resolves.toMatchObject({
      host: '127.0.0.1:3100',
    });
    await expect(assertSafeResolvedCommerceServiceUrl('http://localhost:3101')).resolves.toBeTruthy();
    expect(mockCheckDnsSafety).not.toHaveBeenCalled();
  });

  it('rejects metadata and private hosts before DNS', async () => {
    await expect(assertSafeResolvedCommerceServiceUrl('http://169.254.169.254/latest/meta-data')).rejects.toMatchObject(
      {
        category: 'validation',
      },
    );
    await expect(assertSafeResolvedCommerceServiceUrl('https://intranet.local')).rejects.toMatchObject({
      category: 'validation',
    });
    expect(mockCheckDnsSafety).not.toHaveBeenCalled();
  });

  it('rejects a public hostname that resolves to a link-local address', async () => {
    mockCheckDnsSafety.mockResolvedValueOnce({ ok: false, reason: 'unsafe_ip' });

    await expect(assertSafeResolvedCommerceServiceUrl('https://locks.example.com')).rejects.toMatchObject({
      category: 'validation',
      context: { reason: 'unsafe_ip' },
    });
    expect(mockCheckDnsSafety).toHaveBeenCalledWith('locks.example.com');
  });

  it('allows a public hostname whose resolved addresses are global', async () => {
    mockCheckDnsSafety.mockResolvedValueOnce({
      ok: true,
      addresses: [{ address: '203.0.113.10', family: 4 }],
    });

    await expect(assertSafeResolvedCommerceServiceUrl('https://locks.example.com/v1')).resolves.toMatchObject({
      hostname: 'locks.example.com',
    });
  });
});
