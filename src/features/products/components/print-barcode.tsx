"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/i18n";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { formatMoney } from "@/lib/format";
import { categoryLabel } from "../labels";
import { productUnit, useProducts } from "../store";

type Layout = {
  paperWidth: number;
  paperHeight: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
  labelWidth: number;
  labelHeight: number;
  gap: number;
  fontSize: number;
};

// Sizes are millimetres, except fontSize which is pixels.
const PRESETS: { id: string; label: string; layout: Layout }[] = [
  {
    id: "a4-44",
    label: "B001 - A4 (44 PCS)",
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      padTop: 15,
      padBottom: 15,
      padLeft: 7,
      padRight: 7,
      labelWidth: 48.5,
      labelHeight: 24.2,
      gap: 0,
      fontSize: 10,
    },
  },
  {
    id: "a4-24",
    label: "B002 - A4 (24 PCS)",
    layout: {
      paperWidth: 210,
      paperHeight: 297,
      padTop: 13,
      padBottom: 13,
      padLeft: 9,
      padRight: 9,
      labelWidth: 64,
      labelHeight: 33.9,
      gap: 0,
      fontSize: 12,
    },
  },
  {
    id: "roll-50x30",
    label: "B003 - Roll 50 × 30 mm",
    layout: {
      paperWidth: 50,
      paperHeight: 30,
      padTop: 0,
      padBottom: 0,
      padLeft: 0,
      padRight: 0,
      labelWidth: 50,
      labelHeight: 30,
      gap: 0,
      fontSize: 11,
    },
  },
];

type Field = "site" | "name" | "price" | "unit" | "category" | "image";

export function PrintBarcode() {
  const { t, language } = useLanguage();
  const { products } = useProducts();
  const router = useRouter();
  const initialProduct = useSearchParams().get("product");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<{ id: string; quantity: number }[]>(
    initialProduct ? [{ id: initialProduct, quantity: 1 }] : [],
  );
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [layout, setLayout] = useState<Layout>(PRESETS[0].layout);
  const [fields, setFields] = useState<Field[]>(["site", "name", "price"]);
  const [preview, setPreview] = useState(false);

  const matches = useMemo(() => {
    const term = search.toLocaleLowerCase().trim();
    if (!term) return [];
    return products
      .filter((product) =>
        `${product.name} ${product.sku}`.toLocaleLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [products, search]);

  const labels = items.flatMap(({ id, quantity }) => {
    const product = products.find((item) => item.id === id);
    return product ? Array.from({ length: quantity }, () => product) : [];
  });

  function addItem(id: string) {
    setItems((old) =>
      old.some((item) => item.id === id)
        ? old.map((item) =>
            item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...old, { id, quantity: 1 }],
    );
    setSearch("");
  }

  function reset() {
    setItems([]);
    setPreset(PRESETS[0].id);
    setLayout(PRESETS[0].layout);
    setFields(["site", "name", "price"]);
    setPreview(false);
  }

  const number = (key: keyof Layout, label: string) => (
    <td key={key}>
      <input
        type="number"
        min="0"
        step="0.1"
        aria-label={label}
        value={layout[key]}
        onChange={(event) =>
          setLayout((old) => ({ ...old, [key]: Number(event.target.value) }))
        }
      />
    </td>
  );

  const fieldOptions: [Field, string][] = [
    ["site", t.siteName],
    ["name", t.productName],
    ["price", t.unitPrice],
    ["unit", t.unit],
    ["category", t.category],
    ["image", t.image],
  ];

  return (
    <>
      <Box
        icon="barcode"
        title={t.printBarcodeTitle}
        intro={t.printBarcodeIntro}
        actions={[
          {
            icon: "plus",
            label: t.addProductsLink,
            onClick: () => router.push("/inventory/products/add"),
          },
        ]}
      >
        <div className="well form-well">
          <label className="form-label" htmlFor="barcode-search">
            {t.addProduct}
          </label>
          <div className="autocomplete">
            <input
              id="barcode-search"
              className="form-control"
              value={search}
              placeholder={t.addItem}
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  addItem(matches[0].id);
                }
              }}
            />
            {search && (
              <ul className="autocomplete-list">
                {matches.length ? (
                  matches.map((product) => (
                    <li key={product.id}>
                      <button onClick={() => addItem(product.id)}>
                        {product.name} ({product.sku})
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="no-match">{t.noMatch}</li>
                )}
              </ul>
            )}
          </div>
          <div className="table-responsive">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>
                    {t.productName} ({t.code})
                  </th>
                  <th className="qty-col">{t.quantity}</th>
                  <th className="icon-col">
                    <button
                      className="th-button"
                      aria-label={t.removeAll}
                      title={t.removeAll}
                      onClick={() => setItems([])}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const product = products.find(({ id }) => id === item.id);
                  if (!product) return null;
                  return (
                    <tr key={item.id}>
                      <td>
                        {product.name} ({product.sku})
                      </td>
                      <td className="qty-col">
                        <input
                          type="number"
                          min="1"
                          aria-label={t.quantity}
                          value={item.quantity}
                          onChange={(event) =>
                            setItems((old) =>
                              old.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="icon-col">
                        <button
                          className="link-danger"
                          aria-label={t.remove}
                          onClick={() =>
                            setItems((old) =>
                              old.filter((row) => row.id !== item.id),
                            )
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="form-label" htmlFor="dimension-style">
            {t.dimensionStyle}
          </label>
          <select
            id="dimension-style"
            className="form-control"
            value={preset}
            onChange={(event) => {
              const next = PRESETS.find(({ id }) => id === event.target.value);
              if (!next) return;
              setPreset(next.id);
              setLayout(next.layout);
            }}
          >
            {PRESETS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="table-responsive dimension-table">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th colSpan={6}>{t.paperDimension}</th>
                  <th colSpan={4}>{t.labelDimension}</th>
                </tr>
                <tr>
                  <th>{t.width}</th>
                  <th>{t.height}</th>
                  <th>{t.paddingTop}</th>
                  <th>{t.paddingBottom}</th>
                  <th>{t.paddingLeft}</th>
                  <th>{t.paddingRight}</th>
                  <th>{t.width}</th>
                  <th>{t.height}</th>
                  <th>{t.gap}</th>
                  <th>{t.fontSize}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {number("paperWidth", t.width)}
                  {number("paperHeight", t.height)}
                  {number("padTop", t.paddingTop)}
                  {number("padBottom", t.paddingBottom)}
                  {number("padLeft", t.paddingLeft)}
                  {number("padRight", t.paddingRight)}
                  {number("labelWidth", t.width)}
                  {number("labelHeight", t.height)}
                  {number("gap", t.gap)}
                  {number("fontSize", t.fontSize)}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="help-note">{t.dimensionHint}</p>

          <div className="checkbox-row">
            <b>{t.print}:</b>
            {fieldOptions.map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={fields.includes(id)}
                  onChange={() =>
                    setFields((old) =>
                      old.includes(id)
                        ? old.filter((field) => field !== id)
                        : [...old, id],
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="button-row">
            <button
              className="btn btn-primary"
              disabled={!items.length}
              onClick={() => setPreview(true)}
            >
              {t.update}
            </button>
            <button className="btn btn-danger" onClick={reset}>
              {t.reset}
            </button>
          </div>
        </div>
      </Box>

      {preview && labels.length > 0 && (
        <Box
          icon="print"
          title={t.labelPreview}
          actions={[
            { icon: "print", label: t.print, onClick: () => window.print() },
          ]}
        >
          <p className="help-note">{t.barcodePending}</p>
          <div className="print-area">
            <div
              className="label-sheet"
              style={{
                width: `${layout.paperWidth}mm`,
                minHeight: `${layout.paperHeight}mm`,
                padding: `${layout.padTop}mm ${layout.padRight}mm ${layout.padBottom}mm ${layout.padLeft}mm`,
                gap: `${layout.gap}mm`,
                fontSize: `${layout.fontSize}px`,
              }}
            >
              {labels.map((product, i) => (
                <div
                  key={`${product.id}-${i}`}
                  className="barcode-label"
                  style={{
                    width: `${layout.labelWidth}mm`,
                    height: `${layout.labelHeight}mm`,
                  }}
                >
                  {fields.includes("site") && (
                    <span className="label-site">CHORONAI</span>
                  )}
                  {fields.includes("image") && product.image && (
                    <img src={product.image} alt="" />
                  )}
                  {fields.includes("name") && (
                    <span className="label-name">{product.name}</span>
                  )}
                  <span className="label-code">{product.sku}</span>
                  {fields.includes("category") && (
                    <span>{categoryLabel(product.category, language)}</span>
                  )}
                  {fields.includes("price") && (
                    <b>
                      {formatMoney(product.price)}
                      {fields.includes("unit") && ` / ${productUnit(product)}`}
                    </b>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Box>
      )}
    </>
  );
}
