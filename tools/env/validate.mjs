import fs from 'node:fs';
import path from 'node:path';
import { validateEnvironment } from './contracts.mjs';

/** @typedef {import('./contracts.d.mts').BuildChannel} BuildChannel */

/**
 * Loads a .env-style file into a plain object.
 * @param {string} filePath Path to the .env file.
 * @returns {Record<string, string>}
 */
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  /** @type {Record<string, string>} */
  const result = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}
const channelIndex = process.argv.indexOf('--channel');
const expected = channelIndex >= 0 ? process.argv[channelIndex + 1] : undefined;
/** @type {Record<string, string>} */
const viteEnv = {};
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('VITE_') && typeof value === 'string') viteEnv[key] = value;
}
/** @type {Record<string, string>} */
const raw = {
  ...loadDotEnv(path.resolve(`.env.${expected ?? 'dev'}`)),
  ...viteEnv,
};
const result = validateEnvironment(raw, /** @type {BuildChannel|undefined} */ (expected));
if (!result.ok) {
  console.error(result.errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(JSON.stringify(result.value));