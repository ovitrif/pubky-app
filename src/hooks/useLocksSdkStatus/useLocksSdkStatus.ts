'use client';

import { useEffect, useState } from 'react';
import { getCommerceAdapterMode } from '@/config/commerce';
import { loadLocksSdk, LOCKS_SDK_SOURCE_COMMIT } from '@/libs/locks-sdk/load-locks-sdk';

export function useLocksSdkStatus() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [error, setError] = useState<string | null>(null);
  const adapterMode = getCommerceAdapterMode();

  const verify = async () => {
    setStatus('loading');
    setError(null);
    try {
      const sdk = await loadLocksSdk();
      const bundleId = sdk.BundleId.generate();
      bundleId.free();
      setStatus('ready');
      return true;
    } catch {
      setStatus('unavailable');
      setError('Locks JS/WASM did not initialize in this browser.');
      return false;
    }
  };

  useEffect(() => {
    if (adapterMode !== 'locks-paykit') return;
    void verify();
  }, [adapterMode]);

  return { adapterMode, status, error, sourceCommit: LOCKS_SDK_SOURCE_COMMIT, verify };
}
