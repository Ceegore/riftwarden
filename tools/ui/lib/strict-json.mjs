import { diagnostic, LocaleDiagnostic } from './diagnostic.mjs';

const forbiddenBidi = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

class Parser {
  constructor(text, sourcePath) {
    this.text = text;
    this.sourcePath = sourcePath;
    this.i = 0;
  }

  fail(code, message, offset = this.i) {
    throw diagnostic(code, message, this.text, offset, { sourcePath: this.sourcePath });
  }

  skip() {
    while (this.i < this.text.length && /[\u0020\u0009\u000a\u000d]/u.test(this.text[this.i])) this.i += 1;
  }

  parse() {
    this.skip();
    const value = this.value();
    this.skip();
    if (this.i !== this.text.length) this.fail('L10N_SOURCE_SCHEMA', 'Unexpected trailing JSON data');
    return value;
  }

  value() {
    this.skip();
    const ch = this.text[this.i];
    if (ch === '{') return this.object();
    if (ch === '[') return this.array();
    if (ch === '"') return this.string();
    if (ch === '-' || /[0-9]/u.test(ch ?? '')) return this.number();
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (this.text.startsWith(literal, this.i)) {
        this.i += literal.length;
        return value;
      }
    }
    this.fail('L10N_SOURCE_SCHEMA', 'Expected a JSON value');
  }

  object() {
    const out = {};
    const seen = new Set();
    this.i += 1;
    this.skip();
    if (this.text[this.i] === '}') { this.i += 1; return out; }
    while (this.i < this.text.length) {
      this.skip();
      if (this.text[this.i] !== '"') this.fail('L10N_SOURCE_SCHEMA', 'Expected an object key');
      const keyOffset = this.i;
      const key = this.string();
      if (seen.has(key)) this.fail('L10N_JSON_DUPLICATE_KEY', `Duplicate JSON key: ${key}`, keyOffset);
      seen.add(key);
      this.skip();
      if (this.text[this.i] !== ':') this.fail('L10N_SOURCE_SCHEMA', 'Expected colon after object key');
      this.i += 1;
      out[key] = this.value();
      this.skip();
      if (this.text[this.i] === '}') { this.i += 1; return out; }
      if (this.text[this.i] !== ',') this.fail('L10N_SOURCE_SCHEMA', 'Expected comma or closing brace');
      this.i += 1;
    }
    this.fail('L10N_SOURCE_SCHEMA', 'Unclosed JSON object');
  }

  array() {
    const out = [];
    this.i += 1;
    this.skip();
    if (this.text[this.i] === ']') { this.i += 1; return out; }
    while (this.i < this.text.length) {
      out.push(this.value());
      this.skip();
      if (this.text[this.i] === ']') { this.i += 1; return out; }
      if (this.text[this.i] !== ',') this.fail('L10N_SOURCE_SCHEMA', 'Expected comma or closing bracket');
      this.i += 1;
    }
    this.fail('L10N_SOURCE_SCHEMA', 'Unclosed JSON array');
  }

  string() {
    const start = this.i;
    this.i += 1;
    let out = '';
    while (this.i < this.text.length) {
      const ch = this.text[this.i++];
      if (ch === '"') {
        this.checkString(out, start);
        return out;
      }
      if (ch === '\\') {
        if (this.i >= this.text.length) this.fail('L10N_SOURCE_SCHEMA', 'Unclosed JSON escape');
        const esc = this.text[this.i++];
        const simple = { '"':'"', '\\':'\\', '/':'/', b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' };
        if (Object.hasOwn(simple, esc)) out += simple[esc];
        else if (esc === 'u') {
          const hex = this.text.slice(this.i, this.i + 4);
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) this.fail('L10N_SOURCE_SCHEMA', 'Invalid Unicode escape', this.i - 2);
          out += String.fromCharCode(Number.parseInt(hex, 16));
          this.i += 4;
        } else this.fail('L10N_SOURCE_SCHEMA', `Invalid JSON escape: \\${esc}`, this.i - 2);
      } else {
        if (ch.charCodeAt(0) < 0x20) this.fail('L10N_JSON_FORBIDDEN_CONTROL', 'Unescaped control character in JSON string', this.i - 1);
        out += ch;
      }
    }
    this.fail('L10N_SOURCE_SCHEMA', 'Unclosed JSON string', start);
  }

  checkString(value, offset) {
    if (forbiddenBidi.test(value)) this.fail('L10N_JSON_FORBIDDEN_CONTROL', 'Bidi override/isolate character is forbidden', offset);
    for (const ch of value) {
      const cp = ch.codePointAt(0);
      if (cp === 0 || (cp < 0x20 && ![9, 10, 13].includes(cp))) {
        this.fail('L10N_JSON_FORBIDDEN_CONTROL', 'Forbidden control character in string', offset);
      }
    }
  }

  number() {
    const start = this.i;
    const match = this.text.slice(this.i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    if (!match) this.fail('L10N_SOURCE_SCHEMA', 'Invalid JSON number');
    this.i += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.fail('L10N_SOURCE_SCHEMA', 'JSON number is not finite', start);
    return value;
  }
}

export function parseStrictJson(text, sourcePath = '<memory>') {
  if (typeof text !== 'string') throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'JSON input must be a string', { sourcePath });
  return new Parser(text, sourcePath).parse();
}
