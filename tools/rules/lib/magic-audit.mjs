import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
// Rule indicators covering the real rule-key vocabulary (not just the kit's
// subset): tick-based keys, unit/copy/hero limits, autosave, BPS, formation,
// relic, hero level, position X100 scale keys, FPS target, battle-speed ratios,
// milliValue and resolving/collapse tick keys. Dataset lines (damage: 30) stay
// below the threshold because they carry none of these tokens.
const semantics=/tick|summon|max(?:imum)?units|maxheroes|maxcopies|autosave|basispoints|formation|relic|heroLevel|position[a-z]*100|framesPerSecond|battleSpeed|milliValue|resolving|collaps/i;
const literals=[3,6,7,8,30,45,60,100,450,1000,2700,3600,5400,10000,50000];
// Root is `src`; the canonical rule modules live at game/rules (the optional
// src/ prefix keeps the regex stable if the audit is ever rooted higher).
const allowedPath=/(?:src[\\/])?game[\\/]rules|tests?[\\/].*fixtures|content[\\/](source|generated)|contracts/;
export const lineSha256=line=>createHash('sha256').update(line,'utf8').digest('hex');
function walk(dir,out=[]) { for(const name of readdirSync(dir)){const p=join(dir,name);const s=statSync(p);if(s.isDirectory())walk(p,out);else if(/\.(?:ts|tsx|js|mjs)$/.test(name))out.push(p);}return out; }
function entryInvalid(e) {
  if (typeof e.path !== 'string' || typeof e.literal !== 'number') return 'path/literal missing';
  if (typeof e.owner !== 'string' || e.owner.length === 0) return 'owner missing';
  if (typeof e.reason !== 'string' || e.reason.length < 10) return 'reason shorter than 10 characters';
  if (!String(e.helperTraceId ?? '').startsWith('P11-')) return 'helper trace id missing';
  if (typeof e.lineSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(e.lineSha256)) return 'line sha256 invalid';
  if (typeof e.expiresOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expiresOn)) return 'expiry date missing';
  return null;
}
// Digits may be underscore-separated (10_000); normalize before matching so
// the literal scanner sees the same value the compiler does. Identifiers like
// max_units keep their underscores because only digit-to-digit separators are
// removed, and the preceding word-boundary check keeps type names out.
const normalizeDigits = (line) => line.replace(/(\d)_(?=\d)/g, '$1');
// Comments and string literals carry no executable rule values, so
// documentation prose and data strings must not produce
// P11_MAGIC_VALUE_DUPLICATE findings. Full-line comments (//, /*, *) are
// dropped entirely; trailing comment segments and quoted string contents are
// stripped from code lines. The allowlist hash below still covers the
// original source line so existing entries stay byte-stable.
const stripComments = (line) => {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return '';
  return line
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/, '')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, ' ');
};
export function auditTree(root,allowlist={entries:[]}) {
 const diagnostics=[]; const now=new Date().toISOString().slice(0,10);
 for(const file of walk(root)) { const rel=relative(root,file).replaceAll('\\','/'); if(allowedPath.test(rel))continue;
  const lines=readFileSync(file,'utf8').split(/\r?\n/);
  lines.forEach((line,i)=>{ const code=stripComments(line); if(!semantics.test(code))return; const normalized=normalizeDigits(code); for(const literal of literals){const rx=new RegExp(`(?<![A-Za-z0-9_])${literal}(?![\\d])`);if(!rx.test(normalized))continue;
   const hash=lineSha256(line); const matching=(allowlist.entries??[]).filter(e=>e.path===rel&&e.literal===literal&&e.lineSha256===hash);
   const invalid=matching.find(entryInvalid);
   if (invalid) {
     diagnostics.push({code:'P11_ALLOWLIST_INVALID',path:`${rel}:${i+1}`,message:`allowlist entry ${invalid.owner ?? '?'} invalid: ${entryInvalid(invalid)}`,lineSha256:hash});
     continue;
   }
   const ok=matching.some(e=>e.expiresOn>=now&&String(e.helperTraceId).startsWith('P11-'));
   if(!ok)diagnostics.push({code:'P11_MAGIC_VALUE_DUPLICATE',path:`${rel}:${i+1}`,message:`hard rule literal ${literal}`,lineSha256:hash});
  }});
 }
 return diagnostics;
}
