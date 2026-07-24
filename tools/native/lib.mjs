import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function exists(filePath) {
  try { await stat(filePath); return true; } catch { return false; }
}

export async function readText(filePath, required = true) {
  try { return await readFile(filePath, 'utf8'); }
  catch (error) {
    if (!required) return null;
    throw new Error(`Cannot read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function finding(id, severity, message, file = null) {
  return { id, severity, message, file };
}

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export async function listFiles(root) {
  if (!(await exists(root))) return [];
  const result = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) result.push(full);
    }
  }
  await walk(root);
  return result;
}

export function major(version) {
  const match = /^(?:workspace:)?(?:\^|~)?(\d+)/.exec(version);
  return match ? Number(match[1]) : null;
}

export function isExactVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}

export async function writeJsonStdout(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
