const quote = (value: unknown) => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(quote).join(",")).join("\n");

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
