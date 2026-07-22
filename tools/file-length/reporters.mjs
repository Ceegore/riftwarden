export function humanReport(report) {
  const lines = [`File-length check: ${report.passed ? 'PASS' : 'FAIL'}`];
  for (const finding of report.findings) {
    lines.push(`- [${finding.level.toUpperCase()}] ${finding.code} ${finding.path}${finding.lines === null ? '' : ` (${finding.lines} lines)`}: ${finding.message}`);
  }
  lines.push('Top 20 files:');
  for (const file of report.top20) {
    lines.push(`- ${String(file.lines).padStart(5)} ${file.generated ? '[generated] ' : ''}${file.path}`);
  }
  lines.push(`Summary: ${report.summary.scanned} scanned, ${report.summary.warnings} warnings, ${report.summary.errors} errors.`);
  return `${lines.join('\n')}\n`;
}

export function sarifReport(report) {
  const rules = [
    { id: 'LENGTH_WARN', shortDescription: { text: 'Human-maintained file is 301-500 lines.' } },
    { id: 'LENGTH_BLOCK', shortDescription: { text: 'Human-maintained file is at least 501 lines.' } },
    { id: 'LENGTH_GENERATED_CONTRACT', shortDescription: { text: 'Generated-directory contract is invalid.' } },
    { id: 'LENGTH_READ_ERROR', shortDescription: { text: 'File could not be read.' } },
  ];
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'riftwarden-file-length', rules } },
      results: report.findings.map((finding) => ({
        ruleId: finding.code,
        level: finding.level === 'error' ? 'error' : 'warning',
        message: { text: finding.message },
        locations: finding.path ? [{ physicalLocation: { artifactLocation: { uri: finding.path } } }] : [],
        properties: { lines: finding.lines },
      })),
    }],
  };
}
