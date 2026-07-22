import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { validateEnvironment } from './tools/env/contracts.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

function sourceRevision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'UNVERIFIED_SOURCE';
  }
}

function hashFile(filePath: string) {
  if (!fs.existsSync(filePath)) return 'MISSING';
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function cspPlugin(channel: 'dev' | 'qa' | 'release'): Plugin {
  const csp = channel === 'release'
    ? "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
    : "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  return { name: 'riftwarden-csp', transformIndexHtml: (html) => html.replace('__RW_CSP__', csp) };
}

export default defineConfig(({ mode }) => {
  const raw = loadEnv(mode, root, 'VITE_');
  const result = validateEnvironment(raw, mode as 'dev' | 'qa' | 'release');
  if (!result.ok) throw new Error(`Invalid build environment:\n${result.errors.join('\n')}`);
  const env = result.value;
  const revision = sourceRevision();
  if (env.channel === 'release' && revision === 'UNVERIFIED_SOURCE') {
    throw new Error('Release build requires a verifiable Git source revision.');
  }
  return {
    base: './',
    build: {
      outDir: 'dist',
      sourcemap: env.channel === 'qa' ? 'hidden' : env.channel === 'dev',
      emptyOutDir: true,
    },
    define: {
      __RW_BUILD_MANIFEST__: JSON.stringify({
        channel: env.channel,
        contentVersion: env.contentVersion,
        devtoolsEnabled: env.devtoolsEnabled,
        sourceRevision: revision,
        toolchainFreezeSha256: hashFile(path.join(root, 'docs/reports/toolchain-freeze.json')),
      }),
    },
    plugins: [react(), tailwindcss(), cspPlugin(env.channel)],
    server: { host: '127.0.0.1', strictPort: true },
    preview: { host: '127.0.0.1', strictPort: true },
  };
});
