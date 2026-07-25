import { LocaleDiagnostic } from './diagnostic.mjs';

const marker = /\[\[([^\]]+)\]\]/gu;
const htmlLike = /<\/?[A-Za-z][^>]*>/u;
const urlLike = /(?:https?:\/\/|www\.)/iu;

function fail(message, details = {}) {
  throw new LocaleDiagnostic('L10N_TOKEN_INVALID', message, details);
}

export function assertNoForbiddenMarkup(source, details = {}) {
  if (htmlLike.test(source)) throw new LocaleDiagnostic('L10N_FORBIDDEN_MARKUP', 'HTML-like markup is forbidden in locale copy', details);
  if (urlLike.test(source)) throw new LocaleDiagnostic('L10N_FORBIDDEN_MARKUP', 'URLs are forbidden in locale copy', details);
}

export function compileRichText(ast, registry, details = {}) {
  const definitions = registry.tokens ?? {};

  function compileSequence(nodes, branchPath) {
    const root = [];
    const stack = [{ kind:null, children:root }];
    const append = node => stack.at(-1).children.push(node);

    for (const node of nodes) {
      if (node.t === 'text') {
        let cursor = 0;
        marker.lastIndex = 0;
        let match;
        while ((match = marker.exec(node.v)) !== null) {
          if (match.index > cursor) append({ t:'text', v:node.v.slice(cursor, match.index) });
          processMarker(match[1], stack, append, definitions, { ...details, branchPath });
          cursor = match.index + match[0].length;
        }
        if (cursor < node.v.length) append({ t:'text', v:node.v.slice(cursor) });
      } else if (node.t === 'select' || node.t === 'plural') {
        if (stack.length !== 1) fail('RichText tokens may not cross select/plural controls', { ...details, branchPath });
        const branches = {};
        for (const label of Object.keys(node.b).sort()) {
          branches[label] = compileSequence(node.b[label], `${branchPath}/${node.t}:${node.n}/${label}`);
        }
        append({ ...node, b:branches });
      } else {
        append(node);
      }
    }
    if (stack.length !== 1) fail(`Unclosed RichText token: ${stack.at(-1).kind}`, { ...details, branchPath });
    return root;
  }

  return compileSequence(ast, '$');
}

function processMarker(raw, stack, append, definitions, details) {
  if (raw.startsWith('/')) {
    const kind = raw.slice(1);
    if (stack.length === 1) fail(`Unexpected closing token: ${kind}`, details);
    const opened = stack.at(-1);
    if (opened.kind !== kind) fail(`Mismatched closing token: expected ${opened.kind}, received ${kind}`, details);
    stack.pop();
    return;
  }

  const separator = raw.indexOf(':');
  const kind = separator === -1 ? raw : raw.slice(0, separator);
  const id = separator === -1 ? 'default' : raw.slice(separator + 1);
  const definition = definitions[kind];
  if (!definition) fail(`Unknown RichText token type: ${kind}`, details);
  if (!definition.ids.includes(id)) fail(`Unknown ${kind} token id: ${id}`, details);

  const parent = stack.at(-1);
  if (parent.kind === 'action' && kind === 'action') fail('Action tokens may not be nested', details);
  if (parent.kind && !(definitions[parent.kind]?.allowsNesting ?? []).includes(kind)) {
    fail(`${kind} is not allowed inside ${parent.kind}`, details);
  }

  if (definition.kind === 'self') {
    append({ t:'token', k:kind, id, mode:'self' });
    return;
  }
  const token = { t:'token', k:kind, id, mode:'paired', c:[] };
  append(token);
  stack.push({ kind, children:token.c });
}
