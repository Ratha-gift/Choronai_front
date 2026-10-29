const quote = (value: unknown) => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(quote).join(",")).join("\n");

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

/** Saves text as a file. A BOM keeps Khmer readable when Excel opens CSV. */
export function downloadText(name: string, text: string, type = "text/csv") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([type === "text/csv" ? "﻿" + text : text], {
      type: `${type};charset=utf-8`,
    }),
  );
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
