export const SHEET_ID = "1xZN_ANtwVoPoj0gIhbzn4vgl8VZW9Ex5zE-0Rf7E0t8";
export const SHEET_NAME = "addmision";

export type Application = {
  Timestamp: string;
  SessionId: string;
  FullName: string;
  FatherName: string;
  DateOfBirth: string;
  Gender: string;
  CNIC: string;
  Phone: string;
  Email: string;
  MatricPercentage: string;
  IntermediatePercentage: string;
  Address: string;
  ProgramSelected: string;
  _rowId: string;
  _ts: number;
};

const FIELDS: (keyof Omit<Application, "_rowId" | "_ts">)[] = [
  "Timestamp",
  "SessionId",
  "FullName",
  "FatherName",
  "DateOfBirth",
  "Gender",
  "CNIC",
  "Phone",
  "Email",
  "MatricPercentage",
  "IntermediatePercentage",
  "Address",
  "ProgramSelected",
];

function parseGvizDate(v: string): number {
  // gviz returns "Date(YYYY,M,D,H,M,S)" with 0-indexed month
  const m = /Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/.exec(v);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return new Date(
      Number(y),
      Number(mo),
      Number(d),
      Number(h ?? 0),
      Number(mi ?? 0),
      Number(s ?? 0),
    ).getTime();
  }
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function formatTimestamp(v: string): string {
  const t = parseGvizDate(v);
  if (!t) return v;
  return new Date(t).toLocaleString();
}

export async function fetchApplications(): Promise<Application[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json${
    SHEET_NAME ? `&sheet=${encodeURIComponent(SHEET_NAME)}` : ""
  }&t=${Date.now()}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!text.startsWith("/*O_o*/") && !text.includes("google.visualization")) {
    throw new Error(
      "Sheet is not publicly accessible. In Google Sheets: Share → General access → Anyone with the link (Viewer).",
    );
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

  const cols: { label: string; id: string }[] = json.table.cols;
  const rows: { c: ({ v: unknown; f?: string } | null)[] }[] = json.table.rows;

  // Map columns by header label (fallback to id)
  const labelToIndex = new Map<string, number>();
  cols.forEach((c, i) => labelToIndex.set((c.label || c.id || "").trim(), i));

  return rows
    .map((row, idx): Application | null => {
      if (!row || !row.c) return null;
      const get = (key: string): string => {
        const i = labelToIndex.get(key);
        if (i === undefined) return "";
        const cell = row.c[i];
        if (!cell || cell.v === null || cell.v === undefined) return "";
        return String(cell.f ?? cell.v);
      };

      const obj: Record<string, string> = {};
      FIELDS.forEach((f) => (obj[f] = get(f)));

      const tsRaw = get("Timestamp");
      const tsCell = row.c[labelToIndex.get("Timestamp") ?? -1];
      const _ts = tsCell?.v
        ? typeof tsCell.v === "string"
          ? parseGvizDate(tsCell.v)
          : Date.parse(String(tsCell.v))
        : parseGvizDate(tsRaw);

      const app: Application = {
        ...(obj as unknown as Omit<Application, "_rowId" | "_ts">),
        Timestamp: tsRaw ? formatTimestamp(tsRaw) : "",
        _ts: _ts || 0,
        _rowId: `${idx}-${get("SessionId") || get("CNIC") || tsRaw}`,
      };

      // Skip fully empty rows
      const hasAny = FIELDS.some((f) => (app[f] as string)?.trim());
      return hasAny ? app : null;
    })
    .filter((x): x is Application => x !== null)
    .sort((a, b) => b._ts - a._ts);
}
