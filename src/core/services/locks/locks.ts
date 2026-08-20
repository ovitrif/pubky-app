import { z } from 'zod';
import { getCommerceAdapterMode, getLocksUrl, getPaykitSetupUrl } from '@/config/commerce';
import { isSafeCommerceServiceUrl } from '@/libs/commerce/safe-outbound-url';
import { ServerErrorCode, ValidationErrorCode } from '@/libs/error/error.codes';
import { Err } from '@/libs/error/error.factories';
import { httpResponseToError, safeFetch } from '@/libs/error/error.http';
import { ErrorService } from '@/libs/error/error.types';
import { parseResponseOrThrow } from '@/libs/http/response.utils';
import { generateLocksSdkBundleId, loadLocksSdk } from '@/libs/locks-sdk/load-locks-sdk';

const lifecycleSchema = z.object({
  creator: z.string().min(1),
  bundle_id: z.string().min(16).max(128),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  submitted_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  failure_message: z.string().nullable(),
});

const accessCredentialSchema = z.object({
  credential: z.string().min(1),
  expires_at: z.string(),
});

export type LocksVerificationLifecycle = z.infer<typeof lifecycleSchema>;
export type LocksAccessCredential = z.infer<typeof accessCredentialSchema>;

export class LocksGatewayService {
  private constructor() {}

  static async generateBundleId(): Promise<string> {
    if (getCommerceAdapterMode() === 'locks-paykit') {
      return await generateLocksSdkBundleId();
    }
    return crypto.randomUUID().replaceAll('-', '');
  }

  static async submitPaykitProof({
    creatorPubky,
    readerPubky,
    bundleId,
    lockResource,
    criterionId,
  }: {
    creatorPubky: string;
    readerPubky: string;
    bundleId: string;
    lockResource: string;
    criterionId: string;
  }): Promise<LocksVerificationLifecycle> {
    if (!lockResource.startsWith(`pubky://${creatorPubky}/`)) {
      throw Err.validation(ValidationErrorCode.INVALID_INPUT, 'Locks resource owner does not match the creator.', {
        service: ErrorService.Locks,
        operation: 'submitPaykitProof',
        context: { ownerMatches: false },
      });
    }
    const submittedProofBundle = {
      version: 1,
      bundle_id: bundleId,
      pubky_lock_resource: toLocksResource(lockResource),
      reader_public_key: withPubkyPrefix(readerPubky),
      proofs: [
        {
          criterion_id: criterionId,
          verifier_type: 'paykit-payment',
          payload: {},
        },
      ],
    };
    if (getCommerceAdapterMode() === 'locks-paykit') {
      this.requireLocksUrl();
      const sdk = await loadLocksSdk();
      const client = await sdk.Locks.forContentLock(lockResource);
      try {
        return this.parseLifecycle(await client.viewer.submitProofBundle(submittedProofBundle));
      } finally {
        client.free();
      }
    }
    const url = `${this.requireLocksUrl()}/proof-bundles`;
    return await this.postLifecycle(url, { submitted_proof_bundle: submittedProofBundle });
  }

  static async lookupVerification(creatorPubky: string, bundleId: string): Promise<LocksVerificationLifecycle> {
    if (getCommerceAdapterMode() === 'locks-paykit') {
      this.requireLocksUrl();
      const sdk = await loadLocksSdk();
      const client = await sdk.Locks.forCreator(withPubkyPrefix(creatorPubky));
      const options = new sdk.VerificationTaskHandleOptions(withPubkyPrefix(creatorPubky), bundleId);
      try {
        return this.parseLifecycle(await client.viewer.lookupVerificationTask(options));
      } finally {
        options.free();
        client.free();
      }
    }
    const url = `${this.requireLocksUrl()}/verification-task-lookups`;
    return await this.postLifecycle(url, {
      creator: withPubkyPrefix(creatorPubky),
      bundle_id: bundleId,
    });
  }

  static async issueAccessCredential(creatorPubky: string, bundleId: string): Promise<LocksAccessCredential> {
    if (getCommerceAdapterMode() === 'locks-paykit') {
      this.requireLocksUrl();
      const sdk = await loadLocksSdk();
      const client = await sdk.Locks.forCreator(withPubkyPrefix(creatorPubky));
      const options = new sdk.VerificationTaskHandleOptions(withPubkyPrefix(creatorPubky), bundleId);
      try {
        return this.parseAccessCredential(await client.viewer.issueAccessCredential(options));
      } finally {
        options.free();
        client.free();
      }
    }
    const url = `${this.requireLocksUrl()}/access-credentials`;
    const response = await safeFetch(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator: withPubkyPrefix(creatorPubky), bundle_id: bundleId }),
      },
      ErrorService.Locks,
      'issueAccessCredential',
    );
    if (!response.ok) throw httpResponseToError(response, ErrorService.Locks, 'issueAccessCredential', url);
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Locks, 'issueAccessCredential', url);
    return this.parseAccessCredential(raw, response.status);
  }

  static async fetchGuardedContent(relativePath: string, credential: string): Promise<Blob> {
    const safePath = relativePath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const url = `${this.requireLocksUrl()}/priv-resources/content/${safePath}`;
    const response = await safeFetch(
      url,
      { method: 'GET', headers: { authorization: `Bearer ${credential}` } },
      ErrorService.Locks,
      'fetchGuardedContent',
    );
    if (!response.ok) throw httpResponseToError(response, ErrorService.Locks, 'fetchGuardedContent', url);
    return await response.blob();
  }

  static buildPaykitSetupUrl(returnTo: string, state: string): string {
    const setupUrl = getPaykitSetupUrl();
    if (!isSafeCommerceServiceUrl(setupUrl)) {
      throw Err.validation(ValidationErrorCode.INVALID_INPUT, 'Paykit setup URL is not allowed.', {
        service: ErrorService.Locks,
        operation: 'buildPaykitSetupUrl',
        context: { scheme: 'blocked' },
      });
    }
    const url = new URL(setupUrl);
    url.searchParams.set('return_to', returnTo);
    url.searchParams.set('state', state);
    return url.toString();
  }

  private static requireLocksUrl(): string {
    const url = getLocksUrl();
    if (!isSafeCommerceServiceUrl(url)) {
      throw Err.validation(ValidationErrorCode.INVALID_INPUT, 'Locks URL is not allowed.', {
        service: ErrorService.Locks,
        operation: 'requireLocksUrl',
        context: { scheme: 'blocked' },
      });
    }
    return url;
  }

  private static async postLifecycle(url: string, body: Record<string, unknown>): Promise<LocksVerificationLifecycle> {
    const response = await safeFetch(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      ErrorService.Locks,
      'postLifecycle',
    );
    if (!response.ok) throw httpResponseToError(response, ErrorService.Locks, 'postLifecycle', url);
    const raw = await parseResponseOrThrow<unknown>(response, ErrorService.Locks, 'postLifecycle', url);
    return this.parseLifecycle(raw, response.status);
  }

  private static parseLifecycle(raw: unknown, statusCode = 200): LocksVerificationLifecycle {
    const parsed = lifecycleSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Locks returned an invalid lifecycle response.', {
        service: ErrorService.Locks,
        operation: 'parseLifecycle',
        context: { statusCode },
      });
    }
    return parsed.data;
  }

  private static parseAccessCredential(raw: unknown, statusCode = 200): LocksAccessCredential {
    const parsed = accessCredentialSchema.safeParse(raw);
    if (!parsed.success) {
      throw Err.server(ServerErrorCode.INVALID_RESPONSE, 'Locks returned an invalid access credential response.', {
        service: ErrorService.Locks,
        operation: 'parseAccessCredential',
        context: { statusCode },
      });
    }
    return parsed.data;
  }
}

function withPubkyPrefix(pubky: string): string {
  return pubky.startsWith('pubky') ? pubky : `pubky${pubky}`;
}

function toLocksResource(resource: string): string {
  return resource.startsWith('pubky://') ? `pubky${resource.slice('pubky://'.length)}` : resource;
}
