import { canonicalJson } from './canonical-json.mjs';

const accents = new Map(Object.entries({
  A:'Å',B:'Ɓ',C:'Ç',D:'Ð',E:'Ë',F:'Ƒ',G:'Ĝ',H:'Ħ',I:'Ï',J:'Ĵ',K:'Ķ',L:'Ŀ',M:'Ṁ',N:'Ñ',O:'Ø',P:'Þ',Q:'Ǫ',R:'Ŗ',S:'Š',T:'Ŧ',U:'Ü',V:'Ṽ',W:'Ŵ',X:'Ẍ',Y:'Ÿ',Z:'Ž',
  a:'å',b:'ƀ',c:'ç',d:'ð',e:'ë',f:'ƒ',g:'ĝ',h:'ħ',i:'ï',j:'ĵ',k:'ķ',l:'ŀ',m:'ṁ',n:'ñ',o:'ø',p:'þ',q:'ǫ',r:'ŗ',s:'š',t:'ŧ',u:'ü',v:'ṽ',w:'ŵ',x:'ẍ',y:'ÿ',z:'ž'
}));

function transformLiteral(value) {
  return [...value].map(ch => accents.get(ch) ?? ch).join('');
}

function literalLength(nodes) {
  let total = 0;
  for (const node of nodes) {
    if (node.t === 'text') total += [...node.v].length;
    else if (node.t === 'token' && node.c) total += literalLength(node.c);
  }
  return total;
}

function transformSequence(nodes, wrap) {
  const original = literalLength(nodes);
  const out = [];
  if (wrap) out.push({ t:'text', v:'⟦' });
  for (const node of nodes) {
    if (node.t === 'text') out.push({ ...node, v:transformLiteral(node.v) });
    else if (node.t === 'token' && node.c) out.push({ ...node, c:transformSequence(node.c, false) });
    else if (node.t === 'select' || node.t === 'plural') {
      const branches = {};
      for (const label of Object.keys(node.b).sort()) branches[label] = transformSequence(node.b[label], false);
      out.push({ ...node, b:branches });
    } else out.push(structuredClone(node));
  }
  const target = Math.ceil(original * 1.35);
  const missing = Math.max(0, target - literalLength(out));
  if (missing) out.push({ t:'text', v:` ${'·'.repeat(missing)}` });
  if (wrap) out.push({ t:'text', v:'⟧' });
  return out;
}

export function pseudoLocalizeAst(ast) {
  return transformSequence(ast, true);
}

export function createPseudoBundle(basePayload) {
  const messages = {};
  for (const key of Object.keys(basePayload.messages).sort()) {
    const source = basePayload.messages[key];
    messages[key] = { ...source, ast:pseudoLocalizeAst(source.ast), generatedFrom:'de', reviewStatus:'generated_test_only' };
  }
  return canonicalJson({ schemaVersion:1, locale:'qps-ploc', kind:'generated_test_only_locale_bundle', sourceLocale:'de', messages });
}
