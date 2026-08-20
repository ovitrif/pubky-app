import { beforeEach, describe, expect, it, vi } from 'vitest';

const generate = vi.fn();
const init = vi.fn(async () => ({}));

vi.mock('locks-sdk-wasm', () => ({
  default: init,
  BundleId: {
    generate: () => generate(),
  },
}));

describe('loadLocksSdk', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    generate.mockReturnValue({
      toString: () => '000G40R40M30E209185GR38E1W',
      free: vi.fn(),
    });
  });

  it('initializes the pinned WASM from the public asset and generates a BundleId', async () => {
    const { generateLocksSdkBundleId, LOCKS_SDK_WASM_PUBLIC_PATH, LOCKS_SDK_SOURCE_COMMIT } =
      await import('./load-locks-sdk');

    await expect(generateLocksSdkBundleId()).resolves.toBe('000G40R40M30E209185GR38E1W');
    expect(init).toHaveBeenCalledWith({
      module_or_path: new URL(LOCKS_SDK_WASM_PUBLIC_PATH, window.location.origin),
    });
    expect(LOCKS_SDK_SOURCE_COMMIT).toBe('ba49a777a94db318ec6ebd427315080a5b904645');
  });
});
