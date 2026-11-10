/**
 * Reads the first sheet of an .xlsx file, or a .csv file, as rows of text.
 * No library: an .xlsx is a zip of XML files, and the browser can inflate
 * zip entries itself (DecompressionStream "deflate-raw").
 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  if (!isZip) return parseCsv(new TextDecoder().decode(bytes));
  const files = await unzip(bytes);
  const text = (name: string) =>
    files.has(name) ? new TextDecoder().decode(files.get(name)) : "";
  const xml = (name: string) =>
    new DOMParser().parseFromString(text(name), "application/xml");

  // The first sheet in the workbook, found through its relationship id.
  const workbook = xml("xl/workbook.xml");
  const first = workbook.getElementsByTagNameNS("*", "sheet")[0];
  const relId =
    first?.getAttribute("r:id") ??
    first?.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id",
    );
  const rels = [
    ...xml("xl/_rels/workbook.xml.rels").getElementsByTagNameNS(
      "*",
      "Relationship",
    ),
  ];
  const target = rels
    .find((rel) => rel.getAttribute("Id") === relId)
    ?.getAttribute("Target");
  const sheetPath = target
    ? target.startsWith("/")
      ? target.slice(1)
      : `xl/${target}`
    : "xl/worksheets/sheet1.xml";
  if (!files.has(sheetPath)) throw new Error("No sheet found in this file.");

  const shared = [
    ...xml("xl/sharedStrings.xml").getElementsByTagNameNS("*", "si"),
  ].map((si) =>
    [...si.getElementsByTagNameNS("*", "t")]
      .map((t) => t.textContent ?? "")
      .join(""),
  );
  const rows: string[][] = [];
  for (const row of xml(sheetPath).getElementsByTagNameNS("*", "row")) {
    const index = Number(row.getAttribute("r")) - 1;
    const cells: string[] = [];
    for (const cell of row.getElementsByTagNameNS("*", "c")) {
      const ref = cell.getAttribute("r") ?? "";
      const column = columnIndex(ref) ?? cells.length;
      const type = cell.getAttribute("t");
      const value = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
      cells[column] =
        type === "s"
          ? (shared[Number(value)] ?? "")
          : type === "inlineStr"
            ? [...cell.getElementsByTagNameNS("*", "t")]
                .map((t) => t.textContent ?? "")
                .join("")
            : type === "b"
              ? value === "1"
                ? "TRUE"
                : "FALSE"
              : value;
    }
    rows[index >= 0 ? index : rows.length] = Array.from(
      cells,
      (cell) => cell ?? "",
    );
  }
  return Array.from(rows, (row) => row ?? []);
}

/** "B12" → 1 */
function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0];
  if (!letters) return undefined;
  return (
    [...letters].reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1
  );
}

/** Comma- or semicolon-separated text with "quoted, cells". */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0);
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Entries of a zip file, by path (stored or deflated). */
async function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("This is not an Excel (.xlsx) file.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    at += 46 + nameLength + extraLength + commentLength;
    // Only the parts a sheet needs (skip images and the like).
    if (
      !/^xl\/(workbook\.xml|_rels\/|sharedStrings\.xml|worksheets\/)/.test(name)
    )
      continue;
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, await inflate(data));
  }
  return files;
}

async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
