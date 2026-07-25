export class LocaleDiagnostic extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LocaleDiagnostic';
    this.code = code;
    Object.assign(this, details);
  }

  toJSON() {
    const result = { code: this.code, message: this.message };
    for (const key of ['sourcePath', 'key', 'offset', 'line', 'column']) {
      if (this[key] !== undefined) result[key] = this[key];
    }
    return result;
  }
}

export function locate(text, offset) {
  const prefix = text.slice(0, Math.max(0, offset));
  const lines = prefix.split('\n');
  return { offset, line: lines.length, column: lines.at(-1).length + 1 };
}

export function diagnostic(code, message, text, offset, details = {}) {
  return new LocaleDiagnostic(code, message, { ...details, ...locate(text, offset) });
}

export function normalizeError(error, details = {}) {
  if (error instanceof LocaleDiagnostic) {
    for (const [key, value] of Object.entries(details)) {
      if (error[key] === undefined) error[key] = value;
    }
    return error;
  }
  return new LocaleDiagnostic('L10N_INTERNAL', String(error?.message ?? error), details);
}

export function sortDiagnostics(items) {
  return [...items].sort((a, b) => {
    const ak = [a.sourcePath ?? '', a.key ?? '', a.offset ?? -1, a.code ?? ''].join('\0');
    const bk = [b.sourcePath ?? '', b.key ?? '', b.offset ?? -1, b.code ?? ''].join('\0');
    return ak.localeCompare(bk, 'en');
  });
}
