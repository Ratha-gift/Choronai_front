"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { NativeSelect } from "@/components/ui/select";
import { useCollection } from "@/data/collections";
import { useLanguage, type Label } from "@/i18n";
import { displayCurrency, formatMoney, makeId, toNumber } from "@/lib/format";
import { readSpreadsheet } from "@/lib/spreadsheet";
import { notify } from "@/lib/toast";
import { updateProducts, useProducts } from "../store";
import type { Product } from "../types";

/** Our columns, and the header names they are read from (WeERP's too). */
const COLUMNS = {
  name: ["name", "productname"],
  sku: ["code", "productcode", "sku"],
  brand: ["brand"],
  category: ["categorycode", "category"],
  unit: ["unitcode", "unit"],
  saleUnit: ["saleunitcode", "saleunit"],
  purchaseUnit: ["purchaseunitcode", "purchaseunit"],
  cost: ["cost"],
  price: ["price"],
  alertQuantity: ["alertquantity"],
  image: ["image"],
  subCategory: ["subcategorycode", "subcategory"],
  custom1: ["customfield1", "productcustomfield1"],
  custom2: ["customfield2", "productcustomfield2"],
  custom3: ["customfield3", "productcustomfield3"],
  custom4: ["customfield4", "productcustomfield4"],
  custom5: ["customfield5", "productcustomfield5"],
  custom6: ["customfield6", "productcustomfield6"],
} as const;
type Key = keyof typeof COLUMNS;

/** WeERP columns this system has no place for: read, then left out. */
const NOT_USED: [string[], Label][] = [
  [["barcodesymbology"], ["Barcode Symbology", "ប្រភេទបាកូដ"]],
  [
    ["unitqty", "priceofunit"],
    ["Unit Qty / Price Of Unit", "ចំនួន/តម្លៃតាមឯកតា"],
  ],
  [
    ["taxratename", "taxrate", "tax", "taxmethod"],
    ["Tax", "ពន្ធ"],
  ],
  [
    ["productvariantsseparatedby", "productvariants", "variants"],
    ["Variants", "ប្រភេទរង (Variants)"],
  ],
];

const SAMPLE_HEADERS = [
  "Name",
  "Code",
  "Brand",
  "Category Code",
  "Unit Code",
  "Sale Unit Code",
  "Purchase Unit Code",
  "Cost",
  "Price",
  "Alert Quantity",
  "Image",
  "Subcategory Code",
  "Custom Field 1",
  "Custom Field 2",
  "Custom Field 3",
  "Custom Field 4",
  "Custom Field 5",
  "Custom Field 6",
];

const normalize = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

type Parsed = {
  line: number;
  values: Record<Key, string>;
  product?: Omit<Product, "id" | "updatedAt">;
  errors: Label[];
  warnings: Label[];
};

export function ImportProductsPage() {
  const { l } = useLanguage();
  const router = useRouter();
  const { products } = useProducts();
  const categories = useCollection("categories").rows;
  const currencies = useCollection("currencies").rows;
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<string[][] | null>(null);
  const [currency, setCurrency] = useState<"USD" | "KHR">(
    displayCurrency().code,
  );
  const usdRate =
    toNumber(
      currencies.find((row) => String(row.code).toUpperCase() === "USD")?.rate,
    ) || 4100;
  const rate = currency === "USD" ? usdRate : 1;

  const result = useMemo(() => {
    if (!sheet) return null;
    const [header = [], ...body] = sheet;
    const headers = header.map((cell) => normalize(String(cell)));
    const at = Object.fromEntries(
      (Object.keys(COLUMNS) as Key[]).map((key) => [
        key,
        headers.findIndex((name) =>
          (COLUMNS[key] as readonly string[]).includes(name),
        ),
      ]),
    ) as Record<Key, number>;
    const missing = (["name", "sku", "price"] as Key[]).filter(
      (key) => at[key] < 0,
    );
    // Columns with data we cannot keep, named once above the table.
    const unused = NOT_USED.filter(([names]) =>
      headers.some(
        (name, index) =>
          names.some((known) => name.startsWith(known)) &&
          body.some((row) => String(row[index] ?? "").trim()),
      ),
    ).map(([, label]) => label);
    const known = new Set(products.map((product) => product.sku.trim()));
    const seen = new Set<string>();
    const categoryCode = (value: string) => {
      const wanted = value.trim().toLowerCase();
      const row = categories.find(
        (item) =>
          String(item.code ?? "").toLowerCase() === wanted ||
          String(item.name ?? "").toLowerCase() === wanted,
      );
      return row ? String(row.code ?? row.name) : undefined;
    };
    const rows: Parsed[] = body
      .map((row, index) => ({ row, line: index + 2 }))
      .filter(({ row }) => row.some((cell) => String(cell ?? "").trim()))
      .map(({ row, line }) => {
        const values = Object.fromEntries(
          (Object.keys(COLUMNS) as Key[]).map((key) => [
            key,
            at[key] >= 0 ? String(row[at[key]] ?? "").trim() : "",
          ]),
        ) as Record<Key, string>;
        const errors: Label[] = [];
        const warnings: Label[] = [];
        const number = (text: string) =>
          text === "" ? 0 : Number(text.replace(/[,\s$៛]/g, ""));
        const price = number(values.price);
        const cost = number(values.cost);
        const alert = number(values.alertQuantity);
        if (!values.name) errors.push(["Name is empty", "គ្មានឈ្មោះ"]);
        if (!values.sku) errors.push(["Code is empty", "គ្មានកូដ"]);
        else if (known.has(values.sku))
          errors.push(["Code already exists", "កូដនេះមានរួចហើយ"]);
        else if (seen.has(values.sku))
          errors.push(["Code repeated in the file", "កូដស្ទួនក្នុងឯកសារ"]);
        seen.add(values.sku);
        if (!Number.isFinite(price) || price <= 0)
          errors.push(["Price must be above 0", "តម្លៃត្រូវធំជាង 0"]);
        if (!Number.isFinite(cost) || cost < 0)
          errors.push(["Cost is not a number", "ថ្លៃដើមមិនមែនជាលេខ"]);
        if (!Number.isFinite(alert) || alert < 0)
          errors.push([
            "Alert Quantity is not a number",
            "ចំនួនជូនដំណឹងមិនមែនជាលេខ",
          ]);
        let category = values.category ? categoryCode(values.category) : "";
        if (values.category && !category) {
          warnings.push([
            `Category "${values.category}" is not in Settings → Categories`,
            `ប្រភេទ "${values.category}" មិនមានក្នុង Settings → Categories`,
          ]);
          category = values.category;
        }
        if (!category) category = "Other";
        const unit = values.unit || "pcs";
        const custom = [1, 2, 3, 4, 5, 6].map(
          (n) => values[`custom${n}` as Key],
        );
        while (custom.length && !custom[custom.length - 1]) custom.pop();
        const product: Omit<Product, "id" | "updatedAt"> | undefined =
          errors.length
            ? undefined
            : {
                type: "standard",
                sku: values.sku,
                name: values.name,
                brand: values.brand,
                category,
                subCategory: values.subCategory,
                unit,
                saleUnit: values.saleUnit || unit,
                purchaseUnit: values.purchaseUnit || unit,
                cost: Math.round(cost * rate),
                price: Math.round(price * rate),
                additional: 0,
                promotion: null,
                alertQuantity: alert,
                quantity: 0,
                // Only links: WeERP's file names (no_image.png) are not here.
                image: /^(https?:\/\/|\/)/.test(values.image)
                  ? values.image
                  : "",
                gallery: [],
                customFields: custom,
                details: "",
                invoiceDetails: "",
                suppliers: [],
                comboItems: [],
              };
        return { line, values, product, errors, warnings };
      });
    return { rows, missing, unused };
  }, [sheet, products, categories, rate]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    try {
      setSheet(await readSpreadsheet(file));
    } catch (error) {
      setSheet(null);
      notify(
        error instanceof Error
          ? error.message
          : l(["Cannot read this file", "មិនអាចអានឯកសារនេះបានទេ"]),
        "error",
      );
    }
  }

  const ready = result?.rows.filter((row) => row.product) ?? [];
  const failed = (result?.rows.length ?? 0) - ready.length;

  function importAll() {
    if (!ready.length) return;
    const now = new Date().toISOString();
    updateProducts((old) => [
      ...ready.map(
        (row) => ({ ...row.product, id: makeId(), updatedAt: now }) as Product,
      ),
      ...old,
    ]);
    notify(
      l([
        `${ready.length} products imported`,
        `បាននាំចូលមុខទំនិញ ${ready.length}`,
      ]),
    );
    router.push("/inventory/products");
  }

  return (
    <Box
      icon="file"
      title={l(["Import Products by Excel", "នាំចូលមុខទំនិញពី Excel"])}
    >
      <div className="import-help">
        <div>
          <p>
            {l([
              "The first line of the file is the column names; keep them as they are. Columns are found by name, so their order does not matter. A WeERP product file works as it is.",
              "ជួរទីមួយនៃឯកសារជាឈ្មោះជួរ សូមទុកឲ្យនៅដដែល។ ប្រព័ន្ធរកជួរតាមឈ្មោះ ដូច្នេះលំដាប់មិនសំខាន់ទេ។ ឯកសារទំនិញពី WeERP ប្រើបានដោយផ្ទាល់។",
            ])}
          </p>
          <p>
            {l(["Columns: ", "ជួរ៖ "])}
            <b>Name *, Code *, Price *</b>,{" "}
            {SAMPLE_HEADERS.slice(2)
              .filter((h) => h !== "Price")
              .join(", ")}
          </p>
          <p>
            {l([
              "Category Code must be a code from Settings → Categories. Image must be a link (https://…). New products start with 0 in stock: add stock with Stock Receive.",
              "Category Code ត្រូវជាកូដក្នុង Settings → Categories។ Image ត្រូវជាតំណ (https://…)។ មុខទំនិញថ្មីមានស្តុក 0៖ បន្ថែមស្តុកតាម Stock Receive។",
            ])}
          </p>
        </div>
        <a
          className="btn btn-primary"
          href="/samples/products-import-sample.xlsx"
          download
        >
          <Icon name="download" size={14} />{" "}
          {l(["Download Sample File", "ទាញយកឯកសារគំរូ"])}
        </a>
      </div>

      <div className="import-form">
        <label className="field">
          <span>{l(["Upload File *", "ជ្រើសឯកសារ *"])}</span>
          <div className="input-group file-browse">
            <input
              className="form-control"
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              value={fileName}
            />
            <label className="btn btn-primary">
              <Icon name="folder" size={14} />{" "}
              {l(["Browse ...", "ជ្រើសឯកសារ ..."])}
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                hidden
                onChange={(event) => {
                  pick(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </label>
        <label className="field">
          <span>{l(["Cost and Price are in", "ថ្លៃដើម និងតម្លៃ ជា"])}</span>
          <NativeSelect
            className="form-control"
            value={currency}
            onChange={(event) =>
              setCurrency(event.target.value as "USD" | "KHR")
            }
          >
            <option value="USD">
              {l([
                `US Dollar ($), 1$ = ${usdRate}៛`,
                `ដុល្លារ ($), 1$ = ${usdRate}៛`,
              ])}
            </option>
            <option value="KHR">{l(["Riel (៛)", "រៀល (៛)"])}</option>
          </NativeSelect>
        </label>
      </div>

      {result && result.missing.length > 0 && (
        <p className="import-error">
          {l([
            `This file has no ${result.missing.map((key) => COLUMNS[key][0]).join(", ")} column. Use the sample file.`,
            `ឯកសារនេះគ្មានជួរ ${result.missing.map((key) => COLUMNS[key][0]).join(", ")}។ សូមប្រើឯកសារគំរូ។`,
          ])}
        </p>
      )}
      {result && result.missing.length === 0 && (
        <>
          <p className="import-summary">
            <b>{result.rows.length}</b> {l(["rows", "ជួរ"])} ·{" "}
            <span className="text-success">
              <b>{ready.length}</b> {l(["ready", "រួចរាល់"])}
            </span>
            {failed > 0 && (
              <>
                {" · "}
                <span className="text-danger">
                  <b>{failed}</b>{" "}
                  {l(["with errors (left out)", "មានបញ្ហា (មិននាំចូល)"])}
                </span>
              </>
            )}
            {result.unused.length > 0 && (
              <span className="import-unused">
                {l([
                  "Not used (this system has no place for them): ",
                  "មិនប្រើ (ប្រព័ន្ធនេះគ្មានកន្លែងទុក)៖ ",
                ])}
                {result.unused.map((label) => l(label)).join(", ")}
              </span>
            )}
          </p>
          <div className="table-responsive">
            <table className="data-table import-preview">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{l(["Code", "កូដ"])}</th>
                  <th>{l(["Name", "ឈ្មោះ"])}</th>
                  <th>{l(["Category", "ប្រភេទ"])}</th>
                  <th>{l(["Brand", "ម៉ាក"])}</th>
                  <th>{l(["Unit", "ឯកតា"])}</th>
                  <th className="align-right">{l(["Cost", "ថ្លៃដើម"])}</th>
                  <th className="align-right">{l(["Price", "តម្លៃ"])}</th>
                  <th>{l(["Check", "ពិនិត្យ"])}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr
                    key={row.line}
                    className={row.errors.length ? "import-bad" : ""}
                  >
                    <td>{row.line}</td>
                    <td>{row.values.sku}</td>
                    <td>{row.values.name}</td>
                    <td>{row.product?.category ?? row.values.category}</td>
                    <td>{row.values.brand}</td>
                    <td>{row.product?.unit ?? row.values.unit}</td>
                    <td className="align-right">
                      {row.product
                        ? formatMoney(row.product.cost)
                        : row.values.cost}
                    </td>
                    <td className="align-right">
                      {row.product
                        ? formatMoney(row.product.price)
                        : row.values.price}
                    </td>
                    <td>
                      {row.errors.length ? (
                        <span className="text-danger">
                          {row.errors.map((label) => l(label)).join("; ")}
                        </span>
                      ) : row.warnings.length ? (
                        <span className="text-warning">
                          {row.warnings.map((label) => l(label)).join("; ")}
                        </span>
                      ) : (
                        <span className="text-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="import-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready.length}
          onClick={importAll}
        >
          <Icon name="upload" size={14} />{" "}
          {ready.length
            ? l([
                `Import ${ready.length} products`,
                `នាំចូលមុខទំនិញ ${ready.length}`,
              ])
            : l(["Import", "នាំចូល"])}
        </button>
      </div>
    </Box>
  );
}
