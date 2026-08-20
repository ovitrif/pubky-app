import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocksSdkStatus } from './useLocksSdkStatus';

const adapterMode = vi.hoisted(() => ({ value: 'sandbox' as 'sandbox' | 'locks-paykit' }));

vi.mock('@/config/commerce', () => ({
  getCommerceAdapterMode: () => adapterMode.value,
}));

vi.mock('@/libs/locks-sdk/load-locks-sdk', () => ({
  LOCKS_SDK_SOURCE_COMMIT: 'ba49a777a94db318ec6ebd427315080a5b904645',
  loadLocksSdk: vi.fn(async () => ({
    BundleId: {
      generate: () => ({ free: vi.fn() }),
    },
  })),
}));

describe('useLocksSdkStatus', () => {
  beforeEach(() => {
    adapterMode.value = 'sandbox';
  });

  it('does not auto-load WASM in sandbox mode until verify is clicked', async () => {
    const { result } = renderHook(() => useLocksSdkStatus());
    expect(result.current.status).toBe('idle');
    await act(() => result.current.verify());
    expect(result.current.status).toBe('ready');
    expect(result.current.sourceCommit).toBe('ba49a777a94db318ec6ebd427315080a5b904645');
  });
});
