/** Pure RFC-4180 CSV parser — the inverse of `toCsv` in reporting.ts. No I/O. */

/**
 * Scan CSV text into records of raw string fields. A quoted field may contain
 * commas, CR, LF, and `""`-escaped quotes; quotes are only special at a field's
 * start. Accepts CRLF or LF (or a bare CR) as the record separator.
 */
function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i += 1; continue; // closing quote
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ",") { record.push(field); field = ""; i += 1; continue; }
    if (c === "\r" || c === "\n") {
      record.push(field); field = "";
      records.push(record); record = [];
      i += 1;
      if (c === "\r" && text[i] === "\n") i += 1; // consume the LF of a CRLF
      continue;
    }
    field += c; i += 1;
  }
  // Flush a final field/record only if there's pending content (so a trailing
  // newline doesn't produce a phantom empty record).
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Drop fully-blank lines (a record of a single empty field).
  const records = parseRecords(text).filter((r) => !(r.length === 1 && r[0] === ""));
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((rec) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = rec[idx] ?? ""; });
    return obj;
  });
  return { headers, rows };
}
