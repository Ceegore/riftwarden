import { diagnostic } from './diagnostic.mjs';

const IDENT = /^[A-Za-z_][A-Za-z0-9_.-]*/u;
const TYPES = new Set(['number', 'select', 'plural']);
const PLURAL_LABEL = /^(?:zero|one|two|few|many|other|=[0-9]+)$/u;

export function parseMessage(source, details = {}) {
  if (typeof source !== 'string') throw new TypeError('message source must be a string');
  if (source.length > 4096) throw diagnostic('L10N_SOURCE_SCHEMA', 'Message exceeds 4096 UTF-16 code units', source, 4096, details);
  const parser = new MessageParser(source, details);
  const ast = parser.sequence(null, false, 0);
  if (parser.i !== source.length) parser.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Unexpected trailing message syntax');
  return ast;
}

class MessageParser {
  constructor(source, details) {
    this.source = source;
    this.details = details;
    this.i = 0;
    this.branchCount = 0;
  }

  fail(code, message, offset = this.i) {
    throw diagnostic(code, message, this.source, offset, this.details);
  }

  ws() {
    while (/[ \t\r\n]/u.test(this.source[this.i] ?? '')) this.i += 1;
  }

  identifier() {
    const match = this.source.slice(this.i).match(IDENT);
    if (!match) this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Expected identifier');
    this.i += match[0].length;
    return match[0];
  }

  sequence(until, inPlural, depth) {
    if (depth > 8) this.fail('L10N_SOURCE_SCHEMA', 'Message nesting exceeds 8 levels');
    const nodes = [];
    let text = '';
    const flush = () => { if (text) { nodes.push({ t:'text', v:text }); text = ''; } };
    while (this.i < this.source.length) {
      const ch = this.source[this.i];
      if (until && ch === until) break;
      if (ch === '{') {
        flush();
        nodes.push(this.argument(inPlural, depth));
      } else if (ch === '}') {
        if (!until) this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Unexpected closing brace');
        break;
      } else if (ch === '#') {
        if (!inPlural) this.fail('L10N_GRAMMAR_INVALID_POUND', '# is only valid inside a plural branch');
        flush(); this.i += 1; nodes.push({ t:'pound' });
      } else if (ch === "'") {
        text += this.quoted();
      } else {
        text += ch; this.i += 1;
      }
    }
    flush();
    return nodes;
  }

  quoted() {
    const start = this.i;
    if (this.source[this.i + 1] === "'") { this.i += 2; return "'"; }
    const next = this.source[this.i + 1];
    if (!['{', '}', '#', "'"].includes(next)) { this.i += 1; return "'"; }
    this.i += 1;
    let out = '';
    while (this.i < this.source.length) {
      if (this.source[this.i] === "'") {
        if (this.source[this.i + 1] === "'") { out += "'"; this.i += 2; continue; }
        this.i += 1; return out;
      }
      out += this.source[this.i++];
    }
    this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Unclosed apostrophe quote', start);
  }

  argument(inPlural, depth) {
    const start = this.i++;
    this.ws();
    const name = this.identifier();
    this.ws();
    if (this.source[this.i] === '}') { this.i += 1; return { t:'arg', n:name }; }
    if (this.source[this.i] !== ',') this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Expected comma or closing brace');
    this.i += 1; this.ws();
    const type = this.identifier();
    if (!TYPES.has(type)) this.fail('L10N_GRAMMAR_UNSUPPORTED_TYPE', `Unsupported argument type: ${type}`);
    this.ws();
    if (type === 'number') {
      if (this.source[this.i] !== '}') this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Number styles are unsupported');
      this.i += 1;
      return { t:'number', n:name };
    }
    if (this.source[this.i] !== ',') this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', `Expected comma before ${type} branches`);
    this.i += 1;
    const branches = {};
    while (this.i < this.source.length) {
      this.ws();
      if (this.source[this.i] === '}') break;
      let label;
      if (this.source[this.i] === '=') {
        const m = this.source.slice(this.i).match(/^=[0-9]+/u);
        if (!m) this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', 'Invalid exact plural label');
        label = m[0]; this.i += label.length;
      } else label = this.identifier();
      if (type === 'plural' && !PLURAL_LABEL.test(label)) this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', `Invalid plural label: ${label}`);
      if (Object.hasOwn(branches, label)) this.fail('L10N_GRAMMAR_DUPLICATE_BRANCH', `Duplicate branch: ${label}`);
      this.ws();
      if (this.source[this.i] !== '{') this.fail('L10N_GRAMMAR_UNEXPECTED_TOKEN', `Expected body for branch ${label}`);
      this.i += 1;
      this.branchCount += 1;
      if (this.branchCount > 128) this.fail('L10N_SOURCE_SCHEMA', 'Message exceeds 128 branches', start);
      branches[label] = this.sequence('}', type === 'plural' || inPlural, depth + 1);
      if (this.source[this.i] !== '}') this.fail('L10N_GRAMMAR_UNCLOSED_ARGUMENT', `Unclosed body for branch ${label}`);
      this.i += 1;
    }
    if (this.source[this.i] !== '}') this.fail('L10N_GRAMMAR_UNCLOSED_ARGUMENT', `Unclosed ${type} argument`, start);
    this.i += 1;
    if (!Object.hasOwn(branches, 'other')) this.fail('L10N_GRAMMAR_MISSING_OTHER', `${type} requires an other branch`, start);
    return { t:type, n:name, b:branches };
  }
}
