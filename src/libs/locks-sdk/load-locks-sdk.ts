import { ServerErrorCode } from '@/libs/error/error.codes';
import { Err } from '@/libs/error/error.factories';
import { ErrorService } from '@/libs/error/error.types';

export const LOCKS_SDK_WASM_PUBLIC_PATH = '/locks-sdk/locks_sdk_wasm_bg.wasm';
export const LOCKS_SDK_SOURCE_COMMIT = 'ba49a777a94db318ec6ebd427315080a5b904645';

type LocksSdkModule = typeof import('locks-sdk-wasm');

let loading: Promise<LocksSdkModule> | null = null;

export async function loadLocksSdk(): Promise<LocksSdkModule> {
  if (typeof window === 'undefined') {
    throw Err.server(ServerErrorCode.INTERNAL_ERROR, 'Locks JS/WASM can only load in the browser.', {
      service: ErrorService.Locks,
      operation: 'loadLocksSdk',
      context: { runtime: 'server' },
    });
  }
  if (!loading) {
    loading = import('locks-sdk-wasm').then(async (sdk) => {
      await sdk.default({
        module_or_path: new URL(LOCKS_SDK_WASM_PUBLIC_PATH, window.location.origin),
      });
      return sdk;
    });
  }
  return await loading;
}

export async function generateLocksSdkBundleId(): Promise<string> {
  const sdk = await loadLocksSdk();
  const bundleId = sdk.BundleId.generate();
  try {
    return bundleId.toString();
  } finally {
    bundleId.free();
  }
}
