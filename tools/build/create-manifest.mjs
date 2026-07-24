import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, parseArgs, sha256File } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const channel = args.channel ?? process.env.VITE_BUILD_CHANNEL ?? 'dev';
const out = args.out ?? 'artifacts/provenance/build-manifest.json';
const phase = Number(args.phase ?? process.env.RIFTWARDEN_IMPLEMENTATION_PHASE ?? 3);
const git = (...xs) => execFileSync('git', xs, { encoding: 'utf8' }).trim();
const command = (name, xs) => execFileSync(name, xs, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain').length > 0;
if (channel === 'release' && dirty) throw new Error('Release manifest requires a clean checkout.');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lockfileSha256 = await sha256File('pnpm-lock.yaml');
const sourceTree = JSON.parse(command(process.execPath, ['tools/build/hash-tree.mjs', '--root', '.']));
function phasedVersion(value, activationPhase) {
  if (value) return { state: 'present', value };
  if (phase < activationPhase) return { state: `not-enabled-before-phase-${String(activationPhase).padStart(2, '0')}`, value: null };
  throw new Error(`Version required from phase ${activationPhase} but missing.`);
}
const authoritative = {
  commit,
  dirty,
  channel,
  versions: {
    app: { state: 'present', value: pkg.version },
    content: phasedVersion(process.env.VITE_CONTENT_VERSION, 9),
    simulation: phasedVersion(process.env.RIFTWARDEN_SIMULATION_VERSION, 11),
    save: phasedVersion(process.env.RIFTWARDEN_SAVE_VERSION, 23)
  },
  toolchain: { node: process.version, pnpm: command('pnpm', ['--version']) },
  lockfileSha256,
  sourceTreeSha256: sourceTree.sha256
};
const identitySha256 = createHash('sha256').update(canonicalJson(authoritative)).digest('hex');
const manifest = {
  schemaVersion: 1,
  authoritative,
  informational: {
    createdAtUtc: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runnerOs: process.env.RUNNER_OS ?? process.platform
  },
  identitySha256
};
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(out);
