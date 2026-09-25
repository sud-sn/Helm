import Papa from 'papaparse';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Spreadsheet apps execute cells that start with = + - @ (CSV injection). Prefixing a single
 * quote makes them plain text; `unescapeCell` reverses it on import.
 */
function escapeCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function unescapeCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

/** CSV with a UTF-8 byte-order mark so Excel detects the encoding. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) =>
    row.map((cell) => escapeCell(cell == null ? '' : String(cell))).join(','),
  );
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/** Parses CSV with a header row; header names are normalised to snake_case. */
export function parseCsv(text: string, normaliseHeader: (header: string) => string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normaliseHeader,
    transform: (value) => unescapeCell(value.trim()),
  });
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    errors: result.errors
      .slice(0, 20)
      .map((error) => `Row ${(error.row ?? 0) + 2}: ${error.message}`),
  };
}
