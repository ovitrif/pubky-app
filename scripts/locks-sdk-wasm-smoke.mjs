import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'vendor', 'locks-sdk-wasm');
const publicWasm = join(root, 'public', 'locks-sdk', 'locks_sdk_wasm_bg.wasm');
const pin = JSON.parse(readFileSync(join(vendorDir, 'PIN.json'), 'utf8'));
const pkgJsonPath = join(vendorDir, 'package.json');
const dtsPath = join(vendorDir, 'locks_sdk_wasm.d.ts');
const jsPath = join(vendorDir, 'locks_sdk_wasm.js');
const wasmPath = join(vendorDir, 'locks_sdk_wasm_bg.wasm');

for (const path of [pkgJsonPath, dtsPath, jsPath, wasmPath, publicWasm]) {
  if (!existsSync(path)) {
    throw new Error(`missing generated Locks package artifact: ${path}`);
  }
}

const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
if (pkg.name !== 'locks-sdk-wasm') {
  throw new Error(`unexpected wasm-pack package name: ${pkg.name}`);
}
if (pkg.type !== 'module' || pkg.main !== 'locks_sdk_wasm.js' || pkg.types !== 'locks_sdk_wasm.d.ts') {
  throw new Error('generated package metadata does not match the wasm-pack web target');
}

const checksums = {
  'locks_sdk_wasm_bg.wasm': wasmPath,
  'locks_sdk_wasm.js': jsPath,
  'locks_sdk_wasm.d.ts': dtsPath,
  'package.json': pkgJsonPath,
};
for (const [name, path] of Object.entries(checksums)) {
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (digest !== pin.checksumsSha256[name]) {
    throw new Error(`checksum mismatch for ${name}: ${digest}`);
  }
}

const publicDigest = createHash('sha256').update(readFileSync(publicWasm)).digest('hex');
if (publicDigest !== pin.checksumsSha256['locks_sdk_wasm_bg.wasm']) {
  throw new Error('public Locks WASM asset does not match the vendored checksum');
}

const dts = readFileSync(dtsPath, 'utf8');
const requiredSnippets = [
  'export class Locks',
  'static forServer(lock_server: string): Locks;',
  'static forCreator(creator: string): Promise<Locks>;',
  'export class Viewer',
  'export class BundleId',
  'static generate(): BundleId;',
  'submitProofBundle(submitted_proof_bundle: any): Promise<any>;',
  'lookupVerificationTask(options: VerificationTaskHandleOptions): Promise<any>;',
  'issueAccessCredential(options: VerificationTaskHandleOptions): Promise<any>;',
  'proxyReadGuardedResource(access_credential: string, path: string): Promise<Uint8Array>;',
];
for (const snippet of requiredSnippets) {
  if (!dts.includes(snippet)) {
    throw new Error(`generated TypeScript declarations missing: ${snippet}`);
  }
}

const sdk = await import(pathToFileURL(jsPath));
await sdk.default({ module_or_path: await readFile(wasmPath) });

const bundleId = sdk.BundleId.generate();
const generated = bundleId.toString();
bundleId.free();
if (!/^[0-9A-Z]{16,128}$/.test(generated)) {
  throw new Error(`BundleId.generate() returned an unexpected identifier: ${generated}`);
}

const parsed = new sdk.BundleId(generated);
if (parsed.toString() !== generated) {
  throw new Error('BundleId round-trip failed');
}
parsed.free();

const request = new sdk.CreateContentLockRequestBuilder()
  .primaryResource({
    path: '/priv/locks.app/content/primary.txt',
    hash: '0W3GE1R70W3GE1R70W3GE1R70W3GE1R70W3GE1R70W3GE1R70W3G',
    content_type: 'text/plain',
    size: 13,
  })
  .criteria([])
  .lockLogic({ type: 'all', criteria: [] })
  .accessPolicy({ requested_credential_ttl_seconds: 900 })
  .lockServer({ override: null })
  .build();
if (request instanceof Map || request.primary_resource?.path !== '/priv/locks.app/content/primary.txt') {
  throw new Error('CreateContentLockRequestBuilder did not return a plain object');
}

console.log(
  `locks-sdk-wasm smoke passed commit=${pin.sourceCommit} rustc=${pin.tools.rustc} wasm-pack=${pin.tools.wasmPack} bundleId=${generated}`,
);
