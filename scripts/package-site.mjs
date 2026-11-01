// Package only the static application. Run by the supervising agent or CI.
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (dirname(output) !== root || relative(root, output) !== 'dist') throw new Error('Refusing to package outside the project’s dist directory.');
const manifest = JSON.parse(await readFile(join(root, 'runtime/manifest.json'), 'utf8'));
function runtimePath(value) {
  if (typeof value !== 'string' || !/^\.\/pkg\/[a-zA-Z0-9_.-]+$/.test(value)) throw new Error('Runtime module and WASM must be local files in runtime/pkg.');
  return join(root, 'runtime', value);
}
const modulePath = runtimePath(manifest.module), wasmPath = runtimePath(manifest.wasm);
await lstat(modulePath);
const wasm = await readFile(wasmPath);
if (createHash('sha256').update(wasm).digest('hex') !== manifest.wasmSha256) throw new Error('The compiled WASM hash does not match its runtime manifest.');
const requiredLicences = [
  './licenses/LICENSE-MIT',
  './licenses/LICENSE-APACHE',
  './licenses/THIRD-PARTY-LICENSES.txt',
  './fonts/biz-udp-gothic-OFL.txt',
  './fonts/craft-ui-sc-OFL.txt',
  './fonts/craft-ui-tc-OFL.txt',
];
// Exact local paths, rather than a permissive prefix, also exclude traversal and URLs.
if (!Array.isArray(manifest.licensePaths) || manifest.licensePaths.length !== requiredLicences.length || new Set(manifest.licensePaths).size !== requiredLicences.length || manifest.licensePaths.some(file => !requiredLicences.includes(file))) throw new Error('The runtime manifest must include all native and font licences using their exact local paths.');
if (!manifest.licenseHashes || typeof manifest.licenseHashes !== 'object' || Array.isArray(manifest.licenseHashes) || Object.keys(manifest.licenseHashes).length !== requiredLicences.length || Object.keys(manifest.licenseHashes).some(file => !requiredLicences.includes(file))) throw new Error('The runtime manifest must hash every required native and font licence.');
async function verifyLicences(base) {
  for (const file of requiredLicences) {
    const expected = manifest.licenseHashes[file];
    if (!/^[0-9a-f]{64}$/.test(expected || '')) throw new Error(`Missing or invalid source licence hash: ${file}`);
    const bytes = await readFile(join(base, 'runtime', file));
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`The licence differs from its pinned source: ${file}`);
  }
}
await verifyLicences(root);

const allowlist = ['index.html', 'styles', 'src', 'assets', 'runtime', 'fixtures', 'docs', 'ATTRIBUTION.md', 'LICENSE-MIT', 'LICENSE-APACHE'];
async function verifyTree(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error(`Static packages cannot contain symbolic links: ${relative(root, path)}`);
  if (stat.isDirectory()) for (const name of await readdir(path)) await verifyTree(join(path, name));
  else if (!stat.isFile()) throw new Error(`Unsupported static asset: ${relative(root, path)}`);
}
for (const item of allowlist) await verifyTree(join(root, item));
try { const stat = await lstat(output); if (stat.isSymbolicLink()) throw new Error('dist must not be a symbolic link.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
// The absolute deletion target has been verified above and is fixed to this checkout’s dist.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const item of allowlist) await cp(join(root, item), join(output, item), { recursive: true, errorOnExist: true });
await writeFile(join(output, '.nojekyll'), '');
await writeFile(join(output, 'build-info.json'), JSON.stringify({ format: 'solidcraft-theme-studio-build/1', runtime: { repository: manifest.source, revision: manifest.revision, wasmSha256: manifest.wasmSha256 }, packagedAt: new Date().toISOString() }, null, 2) + '\n');

// Check the copied bytes too; publication always includes unchanged native and font licences.
await verifyLicences(output);
console.log(`Packaged static GitHub Pages site in ${output}${sep} using runtime ${manifest.revision}.`);
