function walk(nodes, path, out) {
  for (const node of nodes) {
    if (node.t === 'arg' || node.t === 'number' || node.t === 'select' || node.t === 'plural') {
      const kind = node.t === 'arg' ? 'string' : node.t;
      const existing = out.parameters.get(node.n);
      if (existing && existing !== kind) out.conflicts.push({ name:node.n, first:existing, second:kind });
      else out.parameters.set(node.n, kind);
    }
    if (node.t === 'select' || node.t === 'plural') {
      const controlPath = `${path}/${node.t}:${node.n}`;
      out.controls.push({ path:controlPath, type:node.t, name:node.n, labels:Object.keys(node.b).sort() });
      for (const label of Object.keys(node.b).sort()) walk(node.b[label], `${controlPath}/${label}`, out);
    }
    if (node.t === 'token') {
      out.tokens.push({ path, kind:node.k, id:node.id, mode:node.mode });
      if (node.c) walk(node.c, `${path}/token:${node.k}:${node.id}`, out);
    }
  }
}

export function analyzeAst(ast) {
  const out = { parameters:new Map(), controls:[], tokens:[], conflicts:[] };
  walk(ast, '$', out);
  return {
    parameters:Object.fromEntries([...out.parameters.entries()].sort()),
    controls:out.controls,
    tokens:out.tokens,
    conflicts:out.conflicts
  };
}

export function visibleLength(nodes, parameterBudgets = {}, branchSelector = null) {
  let total = 0;
  for (const node of nodes) {
    if (node.t === 'text') total += [...node.v].length;
    else if (node.t === 'arg' || node.t === 'number') total += parameterBudgets[node.n] ?? 0;
    else if (node.t === 'pound') total += 4;
    else if (node.t === 'token' && node.c) total += visibleLength(node.c, parameterBudgets, branchSelector);
    else if (node.t === 'select' || node.t === 'plural') {
      const labels = Object.keys(node.b);
      if (branchSelector) total += visibleLength(node.b[branchSelector(node, labels)] ?? node.b.other, parameterBudgets, branchSelector);
      else total += Math.max(...labels.map(label => visibleLength(node.b[label], parameterBudgets, branchSelector)));
    }
  }
  return total;
}

export function countParagraphs(message) {
  return message.split(/\n\s*\n/u).filter(part => part.trim().length > 0).length;
}

export function countSentences(message) {
  const plain = message.replace(/\[\[[^\]]+\]\]/gu, '').trim();
  if (!plain) return 0;
  return plain.split(/(?<=[.!?])(?:\s+|$)/u).filter(Boolean).length;
}
