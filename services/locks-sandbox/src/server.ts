import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

export type LocksSandboxMode = 'sandbox';
export type LocksSandboxStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface LocksSandboxLifecycle {
  creator: string;
  bundle_id: string;
  status: LocksSandboxStatus;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  failure_message: string | null;
}

export interface LocksSandboxCredential {
  bundleId: string;
  creator: string;
  credential: string;
  expiresAt: string;
}

export interface LocksSandboxStore {
  bundles: Map<string, LocksSandboxLifecycle>;
  credentials: Map<string, LocksSandboxCredential>;
  now: () => Date;
}

const PUBKY_SUFFIX = /[ybndrfg8ejkmcpqxot1uwisza345h769]{52}/;
const CREATOR_PREFIX = new RegExp(`^pubky${PUBKY_SUFFIX.source}$`);
const LOCK_RESOURCE = new RegExp(`^pubky${PUBKY_SUFFIX.source}/pub/locks\\.app/.+`);
const READER_KEY = new RegExp(`^pubky${PUBKY_SUFFIX.source}$`);
const BUNDLE_ID = /^[A-Za-z0-9_-]{16,128}$/;

export function createLocksSandboxStore(now: () => Date = () => new Date()): LocksSandboxStore {
  return {
    bundles: new Map(),
    credentials: new Map(),
    now,
  };
}

export function createLocksSandboxHttpServer({
  store = createLocksSandboxStore(),
  maxBodyBytes = 256_000,
}: {
  store?: LocksSandboxStore;
  maxBodyBytes?: number;
} = {}): Server {
  return createServer(async (request, response) => {
    try {
      writeCors(response, 'locks');
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = requestUrl(request);
      if (request.method === 'GET' && url.pathname === '/health/live') {
        writeJson(response, 200, { status: 'live' }, 'locks');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health/ready') {
        writeJson(response, 200, { status: 'ready', mode: 'sandbox', role: 'locks-http-stub' }, 'locks');
        return;
      }
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/connect')) {
        writeHtml(response, renderConnectPage(url.searchParams), 'locks');
        return;
      }
      if (request.method === 'POST' && url.pathname === '/proof-bundles') {
        const body = await readJsonBody(request, maxBodyBytes);
        const result = submitProofBundle(store, body);
        writeJson(response, result.status, result.body, 'locks');
        return;
      }
      if (request.method === 'POST' && url.pathname === '/verification-task-lookups') {
        const body = await readJsonBody(request, maxBodyBytes);
        const result = lookupVerification(store, body);
        writeJson(response, result.status, result.body, 'locks');
        return;
      }
      if (request.method === 'POST' && url.pathname === '/access-credentials') {
        const body = await readJsonBody(request, maxBodyBytes);
        const result = issueCredential(store, body);
        writeJson(response, result.status, result.body, 'locks');
        return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/priv-resources/content/')) {
        const result = readGuardedContent(store, request, url.pathname.slice('/priv-resources/content/'.length));
        if (!result.ok) {
          writeJson(response, result.status, result.body, 'locks');
          return;
        }
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-locks-mode': 'sandbox',
        });
        response.end(JSON.stringify(result.body));
        return;
      }

      writeJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Locks sandbox route not found.' } }, 'locks');
    } catch (error) {
      const code = error instanceof RequestBodyError ? error.code : 'INTERNAL_ERROR';
      const status = error instanceof RequestBodyError ? error.status : 500;
      const message = error instanceof RequestBodyError ? error.message : 'Locks sandbox request failed.';
      if (!(error instanceof RequestBodyError)) {
        console.error('[locks-sandbox] request failed', error);
      }
      writeJson(response, status, { error: { code, message } }, 'locks');
    }
  });
}

export function createPaykitSetupSandboxHttpServer(): Server {
  return createServer((request, response) => {
    try {
      writeCors(response, 'paykit');
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      const url = requestUrl(request);
      if (request.method === 'GET' && url.pathname === '/health/live') {
        writeJson(response, 200, { status: 'live' }, 'paykit');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health/ready') {
        writeJson(response, 200, { status: 'ready', mode: 'sandbox', role: 'paykit-setup-stub' }, 'paykit');
        return;
      }
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/setup')) {
        writeHtml(response, renderSetupPage(url.searchParams), 'paykit');
        return;
      }
      writeJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Paykit setup sandbox route not found.' } }, 'paykit');
    } catch (error) {
      console.error('[locks-sandbox] paykit setup failed', error);
      writeJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'Paykit setup sandbox request failed.' } }, 'paykit');
    }
  });
}

function submitProofBundle(store: LocksSandboxStore, body: unknown): { status: number; body: object } {
  if (!isRecord(body) || !isRecord(body.submitted_proof_bundle)) {
    return {
      status: 400,
      body: { error: { code: 'INVALID_PROOF', message: 'A submitted_proof_bundle object is required.' } },
    };
  }
  const bundle = body.submitted_proof_bundle;
  if (bundle.version !== 1) {
    return { status: 400, body: { error: { code: 'INVALID_PROOF', message: 'Only proof bundle version 1 is accepted.' } } };
  }
  if (typeof bundle.bundle_id !== 'string' || !BUNDLE_ID.test(bundle.bundle_id)) {
    return { status: 400, body: { error: { code: 'INVALID_PROOF', message: 'bundle_id must be 16 to 128 URL-safe characters.' } } };
  }
  if (typeof bundle.pubky_lock_resource !== 'string' || !LOCK_RESOURCE.test(bundle.pubky_lock_resource)) {
    return { status: 400, body: { error: { code: 'INVALID_PROOF', message: 'pubky_lock_resource is not a Locks policy path.' } } };
  }
  if (typeof bundle.reader_public_key !== 'string' || !READER_KEY.test(bundle.reader_public_key)) {
    return { status: 400, body: { error: { code: 'INVALID_PROOF', message: 'reader_public_key must be a prefixed Pubky.' } } };
  }
  if (!Array.isArray(bundle.proofs) || bundle.proofs.length === 0) {
    return { status: 400, body: { error: { code: 'INVALID_PROOF', message: 'At least one Paykit proof is required.' } } };
  }
  for (const proof of bundle.proofs) {
    if (!isRecord(proof) || proof.verifier_type !== 'paykit-payment' || typeof proof.criterion_id !== 'string') {
      return {
        status: 400,
        body: { error: { code: 'INVALID_PROOF', message: 'Sandbox proofs must use verifier_type paykit-payment.' } },
      };
    }
    if (!isRecord(proof.payload) || Object.keys(proof.payload).length > 0) {
      return {
        status: 400,
        body: {
          error: {
            code: 'INVALID_PROOF',
            message: 'Paykit proof payload must be empty. Invoice material is not accepted.',
          },
        },
      };
    }
  }

  const creator = bundle.pubky_lock_resource.slice(0, 57);
  const key = bundleKey(creator, bundle.bundle_id);
  const existing = store.bundles.get(key);
  if (existing) return { status: 200, body: existing };

  const submittedAt = store.now().toISOString();
  const lifecycle: LocksSandboxLifecycle = {
    creator,
    bundle_id: bundle.bundle_id,
    status: 'pending',
    submitted_at: submittedAt,
    started_at: null,
    completed_at: null,
    failure_message: null,
  };
  store.bundles.set(key, lifecycle);
  return { status: 200, body: lifecycle };
}

function lookupVerification(store: LocksSandboxStore, body: unknown): { status: number; body: object } {
  const parsed = parseCreatorBundle(body);
  if (!parsed.ok) return parsed;
  const key = bundleKey(parsed.creator, parsed.bundleId);
  const current = store.bundles.get(key);
  if (!current) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'The sandbox proof bundle was not found.' } } };
  }
  if (current.status === 'completed' || current.status === 'failed') {
    return { status: 200, body: current };
  }
  const completedAt = store.now().toISOString();
  const completed: LocksSandboxLifecycle = {
    ...current,
    status: 'completed',
    started_at: current.started_at ?? completedAt,
    completed_at: completedAt,
    failure_message: null,
  };
  store.bundles.set(key, completed);
  return { status: 200, body: completed };
}

function issueCredential(store: LocksSandboxStore, body: unknown): { status: number; body: object } {
  const parsed = parseCreatorBundle(body);
  if (!parsed.ok) return parsed;
  const key = bundleKey(parsed.creator, parsed.bundleId);
  const current = store.bundles.get(key);
  if (!current) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'The sandbox proof bundle was not found.' } } };
  }
  if (current.status !== 'completed') {
    return {
      status: 409,
      body: { error: { code: 'NOT_READY', message: 'A sandbox credential requires a completed verification.' } },
    };
  }
  const existing = [...store.credentials.values()].find(
    (credential) => credential.bundleId === parsed.bundleId && credential.creator === parsed.creator,
  );
  if (existing && Date.parse(existing.expiresAt) > store.now().getTime()) {
    return { status: 200, body: { credential: existing.credential, expires_at: existing.expiresAt } };
  }
  const issued: LocksSandboxCredential = {
    bundleId: parsed.bundleId,
    creator: parsed.creator,
    credential: `sandbox-locks-${crypto.randomUUID().replaceAll('-', '')}`,
    expiresAt: new Date(store.now().getTime() + 60 * 60 * 1_000).toISOString(),
  };
  store.credentials.set(issued.credential, issued);
  return { status: 200, body: { credential: issued.credential, expires_at: issued.expiresAt } };
}

function readGuardedContent(
  store: LocksSandboxStore,
  request: IncomingMessage,
  relativePath: string,
): { ok: true; body: object } | { ok: false; status: number; body: object } {
  const header = request.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    return { ok: false, status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'A sandbox bearer credential is required.' } } };
  }
  const credential = store.credentials.get(token);
  if (!credential) {
    return { ok: false, status: 403, body: { error: { code: 'FORBIDDEN', message: 'The sandbox credential is unknown.' } } };
  }
  if (Date.parse(credential.expiresAt) <= store.now().getTime()) {
    return { ok: false, status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'The sandbox credential has expired.' } } };
  }
  const safePath = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join('/');
  if (!safePath || safePath.includes('..')) {
    return { ok: false, status: 400, body: { error: { code: 'INVALID_PATH', message: 'Guarded content path is invalid.' } } };
  }
  return {
    ok: true,
    body: {
      mode: 'sandbox',
      notice: 'This is labeled sandbox Locks content. It is not a live Bitkit or Paykit Server delivery.',
      path: safePath,
      creator: credential.creator,
      bundle_id: credential.bundleId,
      bytes: 'sandbox-pattern-pack',
    },
  };
}

function parseCreatorBundle(
  body: unknown,
): { ok: true; creator: string; bundleId: string } | { ok: false; status: number; body: object } {
  if (!isRecord(body) || typeof body.creator !== 'string' || typeof body.bundle_id !== 'string') {
    return {
      ok: false,
      status: 400,
      body: { error: { code: 'INVALID_LOOKUP', message: 'creator and bundle_id are required.' } },
    };
  }
  if (!CREATOR_PREFIX.test(body.creator) || !BUNDLE_ID.test(body.bundle_id)) {
    return {
      ok: false,
      status: 400,
      body: { error: { code: 'INVALID_LOOKUP', message: 'creator or bundle_id is malformed.' } },
    };
  }
  return { ok: true, creator: body.creator, bundleId: body.bundle_id };
}

function bundleKey(creator: string, bundleId: string): string {
  return `${creator}:${bundleId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class RequestBodyError extends Error {
  constructor(
    readonly code: 'INVALID_JSON' | 'BODY_TOO_LARGE',
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBodyBytes) {
      throw new RequestBodyError('BODY_TOO_LARGE', 413, 'Request body is too large.');
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestBodyError('INVALID_JSON', 400, 'Request body must be valid JSON.');
  }
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
}

function writeCors(response: ServerResponse, service: 'locks' | 'paykit'): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type, authorization');
  response.setHeader(service === 'locks' ? 'x-locks-mode' : 'x-paykit-mode', 'sandbox');
}

function writeJson(response: ServerResponse, status: number, body: object, service: 'locks' | 'paykit'): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    [service === 'locks' ? 'x-locks-mode' : 'x-paykit-mode']: 'sandbox',
  });
  response.end(JSON.stringify(body));
}

function writeHtml(response: ServerResponse, html: string, service: 'locks' | 'paykit'): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    [service === 'locks' ? 'x-locks-mode' : 'x-paykit-mode']: 'sandbox',
  });
  response.end(html);
}

function renderConnectPage(params: URLSearchParams): string {
  const returnTo = safeReturnTo(params.get('return_to'));
  const state = escapeHtml(params.get('state') ?? '');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sandbox Locks connect</title>
  </head>
  <body>
    <p>SANDBOX</p>
    <h1>Sandbox Locks connect</h1>
    <p>This is a labeled local stub. It is not Pubky Ring and does not grant live creator authority.</p>
    <p>No identity secret is collected. No Bitcoin moves.</p>
    <p>return_to: ${escapeHtml(returnTo ?? '')}</p>
    <p>state: ${state}</p>
    ${returnTo ? `<p><a href="${escapeHtml(returnTo)}">Return to Pubky App</a></p>` : ''}
  </body>
</html>`;
}

function renderSetupPage(params: URLSearchParams): string {
  const returnTo = safeReturnTo(params.get('return_to'));
  const state = escapeHtml(params.get('state') ?? '');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sandbox Paykit setup</title>
  </head>
  <body>
    <p>SANDBOX</p>
    <h1>Sandbox Paykit / Bitkit setup</h1>
    <p>This is a labeled local stub. It is not Bitkit and does not create a watch-only BIP84 account.</p>
    <p>Pubky App never receives wallet keys. This page does not show a Bitcoin invoice.</p>
    <p>return_to: ${escapeHtml(returnTo ?? '')}</p>
    <p>state: ${state}</p>
    ${returnTo ? `<p><a href="${escapeHtml(returnTo)}">Return to Pubky App</a></p>` : ''}
  </body>
</html>`;
}

function safeReturnTo(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

async function listen(server: Server, host: string, port: number, label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      console.info(`[locks-sandbox] ${label} listening on ${host}:${port} (sandbox)`);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const host = process.env.LOCKS_SANDBOX_HOST ?? '127.0.0.1';
  const locksPort = Number.parseInt(process.env.LOCKS_SANDBOX_PORT ?? '3101', 10);
  const paykitPort = Number.parseInt(process.env.PAYKIT_SETUP_SANDBOX_PORT ?? '3102', 10);
  const store = createLocksSandboxStore();
  await listen(createLocksSandboxHttpServer({ store }), host, locksPort, 'locks');
  await listen(createPaykitSetupSandboxHttpServer(), host, paykitPort, 'paykit-setup');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
