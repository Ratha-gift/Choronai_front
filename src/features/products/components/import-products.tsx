"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { useLanguage } from "@/i18n";
import { downloadText, toCsv } from "@/lib/csv";
import { notify } from "@/lib/toast";
import { CSV_COLUMNS, importProducts } from "../actions";

export function ImportProducts() {
  const { t } = useLanguage();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const { added, skipped } = await importProducts(file);
    notify(
      t.importResult
        .replace("{added}", String(added))
        .replace("{skipped}", String(skipped)),
    );
    setFile(null);
    if (input.current) input.current.value = "";
    if (added) router.push("/inventory/products");
  }

  return (
    <Box icon="file" title={t.importTitle}>
      <div className="well">
        <button
          className="btn btn-primary well-action"
          onClick={() =>
            downloadText(
              "choronai-sample-products.csv",
              toCsv([
                CSV_COLUMNS,
                ["Fresh beef", "MEAT-101", "Meat", "kg", 25000, 32000, 10, 5],
                [
                  "Snakehead fish",
                  "FISH-101",
                  "Fish",
                  "kg",
                  21000,
                  28000,
                  8,
                  3,
                ],
              ]),
            )
          }
        >
          <Icon name="download" size={14} /> {t.downloadSample}
        </button>
        <p className="warning-text">{t.importFirstLine}</p>
        <p>
          {t.importColumns}{" "}
          <span className="info-text">({CSV_COLUMNS.join(", ")})</span>{" "}
          {t.importFollow}
        </p>
        <p>{t.importCategories}</p>
        <p>{t.importEncoding}</p>
      </div>
      <form onSubmit={submit} className="import-form">
        <label className="form-label" htmlFor="import-file">
          {t.uploadFile} *
        </label>
        <div className="file-input">
          <input
            className="form-control"
            readOnly
            tabIndex={-1}
            value={file?.name ?? ""}
            onClick={() => input.current?.click()}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => input.current?.click()}
          >
            <Icon name="folder" size={14} /> {t.browse}
          </button>
          <input
            id="import-file"
            ref={input}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={!file}>
          {t.import}
        </button>
      </form>
    </Box>
  );
}
