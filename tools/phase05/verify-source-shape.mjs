import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { exists, reportAndExit } from './lib/io.mjs';

const root = process.cwd();
const required = [
  'src/app/boot/boot-types.ts',
  'src/app/boot/boot-state.ts',
  'src/app/boot/boot-timeouts.ts',
  'src/platform/lifecycle/coordinator.ts',
  'src/platform/diagnostics/logger.ts',
  'src/platform/render/capability.ts',
  'src/app/AppErrorBoundary.tsx',
  'src/app/AppRoot.tsx',
  'src/screens/system/BootstrapScreen.tsx',
  'src/screens/system/FatalErrorScreen.tsx',
];
const errors = [];

for (const relative of required) {
  if (!(await exists(path.join(root, relative)))) {
    errors.push(`Missing required source file: ${relative}`);
  }
}

const sourceFiles = [
  'src/app/boot/boot-state.ts',
  'src/platform/lifecycle/coordinator.ts',
  'src/platform/diagnostics/logger.ts',
  'src/platform/render/capability.ts',
];
const forbidden = [
  /\bMath\.random\s*\(/,
  /\bDate\.now\s*\(/,
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /dangerouslySetInnerHTML/,
];

for (const relative of sourceFiles) {
  const absolute = path.join(root, relative);
  if (!(await exists(absolute))) continue;
  const text = await readFile(absolute, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      errors.push(`${relative} contains forbidden ${pattern}.`);
    }
  }
}

const bootState = await readFile(
  path.join(root, 'src/app/boot/boot-state.ts'),
  'utf8',
);
if (!bootState.includes("case 'LOAD_SAVE_RESOLVED'")) {
  errors.push('Boot reducer does not resolve LOAD_SAVE outcomes explicitly.');
}
if (!bootState.includes("state.step !== 'RECOVERY_REQUIRED'")) {
  errors.push('Retry must be restricted to the recovery state.');
}

reportAndExit({
  tool: 'verify-source-shape',
  ok: errors.length === 0,
  errors,
});
