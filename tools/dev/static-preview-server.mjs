#!/usr/bin/env node
/**
 * Minimal static file server for serving the built dist/ directory during
 * local manual verification. Serves with correct content types and no
 * directory traversal.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.env.DIST_ROOT ?? 'dist');
const port = Number(process.env.PORT ?? '5198') || 5198;
const host = process.env.HOST ?? '127.0.0.1';

/** @type {Record<string,string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  let filePath = normalize(join(root, urlPath === '/' ? 'index.html' : urlPath));
  if (!filePath.startsWith(resolve(root))) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html');
  }
  const type = MIME[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(readFileSync(filePath));
}).listen(port, host, () => {
  console.log(`static server: http://${host}:${port} serving ${root}`);
});
