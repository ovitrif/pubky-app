import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceController } from '@/controllers/commerce/commerce';
import { useLocksPayment } from './useLocksPayment';

const CREATOR = 'y'.repeat(52);
const BUNDLE_ID = '00000000-0000-4000-8000-000000001200'.replaceAll('-', '');

vi.mock('@/config/commerce', async () => {
  const actual = await vi.importActual<typeof import('@/config/commerce')>('@/config/commerce');
  return { ...actual, getCommercePollIntervalMs: () => 1_000 };
});

vi.mock('@/controllers/commerce/commerce', () => ({
  CommerceController: {
    submitLocksPaykitProof: vi.fn(),
    lookupLocksVerification: vi.fn(),
    issueLocksAccessCredential: vi.fn(),
  },
}));

describe('useLocksPayment', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000001200');
    vi.mocked(CommerceController.submitLocksPaykitProof).mockResolvedValue({
      creator: `pubky${CREATOR}`,
      bundle_id: BUNDLE_ID,
      status: 'pending',
      submitted_at: '2026-08-19T23:00:00.000Z',
      started_at: null,
      completed_at: null,
      failure_message: null,
    });
  });

  it('submits the Paykit criterion through Locks without wallet material', async () => {
    const { result } = renderHook(() =>
      useLocksPayment({
        creatorPubky: CREATOR,
        lockResource: `pubky://${CREATOR}/pub/locks.app/lock.json`,
        criterionId: 'criterion-1',
      }),
    );

    await act(() => result.current.start());

    expect(CommerceController.submitLocksPaykitProof).toHaveBeenCalledWith({
      creatorPubky: CREATOR,
      bundleId: BUNDLE_ID,
      lockResource: `pubky://${CREATOR}/pub/locks.app/lock.json`,
      criterionId: 'criterion-1',
    });
    expect(result.current.lifecycle?.status).toBe('pending');
    expect(result.current.credential).toBeNull();
  });

  it('issues a credential when Locks already completed the empty Paykit proof', async () => {
    vi.mocked(CommerceController.submitLocksPaykitProof).mockResolvedValue({
      creator: `pubky${CREATOR}`,
      bundle_id: BUNDLE_ID,
      status: 'completed',
      submitted_at: '2026-08-19T23:00:00.000Z',
      started_at: '2026-08-19T23:00:01.000Z',
      completed_at: '2026-08-19T23:00:02.000Z',
      failure_message: null,
    });
    vi.mocked(CommerceController.issueLocksAccessCredential).mockResolvedValue({
      credential: 'sandbox-locks-opaque',
      expires_at: '2026-08-20T00:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useLocksPayment({
        creatorPubky: CREATOR,
        lockResource: `pubky://${CREATOR}/pub/locks.app/lock.json`,
        criterionId: 'criterion-1',
      }),
    );

    await act(() => result.current.start());

    expect(CommerceController.issueLocksAccessCredential).toHaveBeenCalledWith(CREATOR, BUNDLE_ID);
    expect(result.current.lifecycle?.status).toBe('completed');
    expect(result.current.credential).toEqual({
      credential: 'sandbox-locks-opaque',
      expires_at: '2026-08-20T00:00:00.000Z',
    });
  });

  it('keeps the credential when polling completes the pending proof', async () => {
    vi.useFakeTimers();
    vi.mocked(CommerceController.lookupLocksVerification).mockResolvedValue({
      creator: `pubky${CREATOR}`,
      bundle_id: BUNDLE_ID,
      status: 'completed',
      submitted_at: '2026-08-19T23:00:00.000Z',
      started_at: '2026-08-19T23:00:01.000Z',
      completed_at: '2026-08-19T23:00:02.000Z',
      failure_message: null,
    });
    vi.mocked(CommerceController.issueLocksAccessCredential).mockImplementation(async () => {
      await Promise.resolve();
      return {
        credential: 'sandbox-locks-polled',
        expires_at: '2026-08-20T00:00:00.000Z',
      };
    });

    const { result } = renderHook(() =>
      useLocksPayment({
        creatorPubky: CREATOR,
        lockResource: `pubky://${CREATOR}/pub/locks.app/lock.json`,
        criterionId: 'criterion-1',
      }),
    );

    await act(() => result.current.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(result.current.lifecycle?.status).toBe('completed');
    expect(result.current.credential).toEqual({
      credential: 'sandbox-locks-polled',
      expires_at: '2026-08-20T00:00:00.000Z',
    });
    vi.useRealTimers();
  });
});
