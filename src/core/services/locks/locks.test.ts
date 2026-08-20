import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocksGatewayService } from './locks';

const CREATOR = 'y'.repeat(52);
const READER = 'b'.repeat(52);
const BUNDLE_ID = '000G40R40M30E209185GR38E1W';

const adapterMode = vi.hoisted(() => ({ value: 'sandbox' as 'sandbox' | 'locks-paykit' }));
const sdkViewer = vi.hoisted(() => ({
  submitProofBundle: vi.fn(),
  lookupVerificationTask: vi.fn(),
  issueAccessCredential: vi.fn(),
  proxyReadGuardedResource: vi.fn(),
}));

vi.mock('@/config/commerce', async () => {
  const actual = await vi.importActual<typeof import('@/config/commerce')>('@/config/commerce');
  return {
    ...actual,
    getCommerceAdapterMode: () => adapterMode.value,
    getLocksUrl: () => 'https://locks.example.com',
    getPaykitSetupUrl: () => 'https://paykit.example.com/setup',
  };
});

vi.mock('@/libs/locks-sdk/load-locks-sdk', () => ({
  generateLocksSdkBundleId: vi.fn(async () => '000G40R40M30E209185GR38E1W'),
  loadLocksSdk: vi.fn(async () => ({
    Locks: {
      forContentLock: async () => ({
        viewer: sdkViewer,
        free: vi.fn(),
      }),
      forCreator: async () => ({
        viewer: sdkViewer,
        free: vi.fn(),
      }),
    },
    VerificationTaskHandleOptions: class {
      constructor(
        readonly creator: string,
        readonly bundleId: string,
      ) {}
      free() {}
    },
  })),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function lifecycle(status: 'pending' | 'completed' = 'pending') {
  return {
    creator: `pubky${CREATOR}`,
    bundle_id: BUNDLE_ID,
    status,
    submitted_at: '2026-08-19T23:00:00.000Z',
    started_at: null,
    completed_at: status === 'completed' ? '2026-08-19T23:01:00.000Z' : null,
    failure_message: null,
  };
}

describe('LocksGatewayService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapterMode.value = 'sandbox';
  });

  it('submits the canonical empty Paykit proof without invoice material', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(lifecycle()));

    await LocksGatewayService.submitPaykitProof({
      creatorPubky: CREATOR,
      readerPubky: READER,
      bundleId: BUNDLE_ID,
      lockResource: `pubky://${CREATOR}/pub/locks.app/lock.json`,
      criterionId: 'criterion-1',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://locks.example.com/proof-bundles',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          submitted_proof_bundle: {
            version: 1,
            bundle_id: BUNDLE_ID,
            pubky_lock_resource: `pubky${CREATOR}/pub/locks.app/lock.json`,
            reader_public_key: `pubky${READER}`,
            proofs: [{ criterion_id: 'criterion-1', verifier_type: 'paykit-payment', payload: {} }],
          },
        }),
      }),
    );
  });

  it('looks up lifecycle and requests a credential without putting bearer ids in URLs', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(lifecycle('completed')))
      .mockResolvedValueOnce(jsonResponse({ credential: 'opaque-secret', expires_at: '2026-08-20T00:00:00.000Z' }));

    await expect(LocksGatewayService.lookupVerification(CREATOR, BUNDLE_ID)).resolves.toMatchObject({
      status: 'completed',
    });
    await expect(LocksGatewayService.issueAccessCredential(CREATOR, BUNDLE_ID)).resolves.toMatchObject({
      credential: 'opaque-secret',
    });

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://locks.example.com/verification-task-lookups');
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('https://locks.example.com/access-credentials');
    expect(vi.mocked(fetch).mock.calls.flatMap((call) => String(call[0]))).not.toContain(BUNDLE_ID);
  });

  it('uses bearer authorization only for guarded content retrieval', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    );

    await LocksGatewayService.fetchGuardedContent('orders/proof image.jpg', 'opaque-secret');

    expect(fetch).toHaveBeenCalledWith(
      'https://locks.example.com/priv-resources/content/orders/proof%20image.jpg',
      expect.objectContaining({ headers: { authorization: 'Bearer opaque-secret' } }),
    );
  });

  it('builds exact-origin Paykit setup callbacks', () => {
    expect(
      LocksGatewayService.buildPaykitSetupUrl('https://app.example.com/marketplace/settings', 'opaque-state'),
    ).toBe(
      'https://paykit.example.com/setup?return_to=https%3A%2F%2Fapp.example.com%2Fmarketplace%2Fsettings&state=opaque-state',
    );
  });

  it('generates a random hex bundle id in sandbox mode', async () => {
    const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(uuid);
    await expect(LocksGatewayService.generateBundleId()).resolves.toBe(uuid.replaceAll('-', ''));
  });

  it('uses the vendored Locks SDK viewer in locks-paykit mode', async () => {
    adapterMode.value = 'locks-paykit';
    sdkViewer.submitProofBundle.mockResolvedValue(lifecycle());
    sdkViewer.lookupVerificationTask.mockResolvedValue(lifecycle('completed'));
    sdkViewer.issueAccessCredential.mockResolvedValue({
      credential: 'opaque-secret',
      expires_at: '2026-08-20T00:00:00.000Z',
    });
    await expect(LocksGatewayService.generateBundleId()).resolves.toBe(BUNDLE_ID);
    await LocksGatewayService.submitPaykitProof({
      creatorPubky: CREATOR,
      readerPubky: READER,
      bundleId: BUNDLE_ID,
      lockResource: `pubky://${CREATOR}/pub/locks.app/lock.json`,
      criterionId: 'criterion-1',
    });
    await LocksGatewayService.lookupVerification(CREATOR, BUNDLE_ID);
    await LocksGatewayService.issueAccessCredential(CREATOR, BUNDLE_ID);

    expect(sdkViewer.submitProofBundle).toHaveBeenCalledWith({
      version: 1,
      bundle_id: BUNDLE_ID,
      pubky_lock_resource: `pubky${CREATOR}/pub/locks.app/lock.json`,
      reader_public_key: `pubky${READER}`,
      proofs: [{ criterion_id: 'criterion-1', verifier_type: 'paykit-payment', payload: {} }],
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
