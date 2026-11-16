/** RFC4180 field escaping, plus a guard against spreadsheet formula injection. */
export function csvField(v: unknown): string {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvField).join(','), ...rows.map((r) => r.map(csvField).join(','))].join('\r\n') + '\r\n';
}
