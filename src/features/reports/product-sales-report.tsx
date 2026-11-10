"use client";
import { Fragment, useMemo, useState } from "react";
import { Box } from "@/components/ui/box";
import { NativeSelect } from "@/components/ui/select";
import { useCollection } from "@/data/collections";
import type { LineItem } from "@/data/types";
import { categoryLabel } from "@/features/products/labels";
import { productCost, productUnit } from "@/features/products/store";
import type { Product } from "@/features/products/types";
import {
  useBranchTitle,
  usePermissions,
} from "@/features/settings/permissions";
import { useLanguage } from "@/i18n";
import { downloadText, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber, toNumber } from "@/lib/format";
import { useReportData } from "./use-report-data";

type Line = {
  productId: string;
  name: string;
  code: string;
  type: string;
  category: string;
  subCategory: string;
  unit: string;
  sold: number;
  gross: number;
  discount: number;
  cost: number;
};

type Filters = {
  from: string;
  to: string;
  branch: string;
  category: string;
  cashier: string;
};

const NO_FILTERS: Filters = {
  from: "",
  to: "",
  branch: "",
  category: "",
  cashier: "",
};

/** Discount given on one sale line (percent or riel), never above the line. */
function lineDiscount(line: LineItem) {
  const subtotal = line.price * line.quantity;
  const discount = line.productDiscount;
  if (!discount) return 0;
  const amount = discount.percent
    ? (subtotal * toNumber(discount.value)) / 100
    : toNumber(discount.value);
  return Math.min(subtotal, Math.max(0, amount));
}

/** Cost of one unit; a combo without its own cost costs its parts. */
function unitCost(product: Product | undefined, byId: Map<string, Product>) {
  if (!product) return 0;
  const own = productCost(product);
  if (own > 0 || product.type !== "combo") return own;
  return (product.comboItems ?? []).reduce(
    (sum, item) =>
      sum +
      productCost(byId.get(item.productId) ?? ({} as Product)) * item.quantity,
    0,
  );
}

/**
 * Sold products grouped by category: quantity sold, unit price, discount,
 * cost, sales and net profit, with a subtotal per category and a grand
 * total. `type` keeps only simple (stocked) or combo products.
 */
export function ProductSalesReport({ type }: { type?: "simple" | "combo" }) {
  const { l, t, language } = useLanguage();
  const branchTitle = useBranchTitle();
  const { can, branch: ownBranch } = usePermissions();
  const { sales, products } = useReportData();
  const branches = useCollection("branches").rows;
  const showCost = can("products.cost");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const byId = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const cashiers = [...new Set(sales.map((sale) => sale.createdBy))]
    .filter(Boolean)
    .sort();

  const groups = useMemo(() => {
    const lines = new Map<string, Line>();
    for (const sale of sales) {
      const day = String(sale.date).slice(0, 10);
      if (filters.from && day < filters.from) continue;
      if (filters.to && day > filters.to) continue;
      if (filters.branch && sale.branch !== filters.branch) continue;
      if (filters.cashier && sale.createdBy !== filters.cashier) continue;
      for (const item of sale.items) {
        const product = byId.get(item.productId);
        const isCombo = product?.type === "combo";
        if (type && (type === "combo") !== isCombo) continue;
        const category = String(product?.category ?? "Other");
        if (filters.category && category !== filters.category) continue;
        const line = lines.get(item.productId) ?? {
          productId: item.productId,
          name: product?.name ?? item.name,
          code: product?.sku ?? item.code,
          type: product?.type ?? "standard",
          category,
          subCategory: product?.subCategory ?? "",
          unit: item.unit || (product ? productUnit(product) : ""),
          sold: 0,
          gross: 0,
          discount: 0,
          cost: 0,
        };
        line.sold += item.quantity;
        line.gross += item.price * item.quantity;
        line.discount += lineDiscount(item);
        line.cost += unitCost(product, byId) * item.quantity;
        lines.set(item.productId, line);
      }
    }
    const byCategory = new Map<string, Line[]>();
    for (const line of lines.values())
      byCategory.set(line.category, [
        ...(byCategory.get(line.category) ?? []),
        line,
      ]);
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, rows]) => ({
        category,
        rows: rows.sort((a, b) => a.code.localeCompare(b.code)),
      }));
  }, [sales, byId, type, filters]);

  const sum = (rows: Line[], pick: (line: Line) => number) =>
    rows.reduce((total, line) => total + pick(line), 0);
  const unitPrice = (line: Line) => (line.sold ? line.gross / line.sold : 0);
  const net = (line: Line) => line.gross - line.discount;
  const profit = (line: Line) => net(line) - line.cost;
  const allRows = groups.flatMap((group) => group.rows);
  const categories = [
    ...new Set(products.map((product) => String(product.category))),
  ].sort();
  const columns = 7 + (showCost ? 2 : 0);
  const qty = (line: Line) => `${formatNumber(line.sold, 3)}`;
  // A combo's contents, like WeERP: each part and how much of it went out
  // (part quantity per set × sets sold), from the combo as it is set up now.
  const partsOf = (line: Line) =>
    line.type !== "combo"
      ? []
      : (byId.get(line.productId)?.comboItems ?? []).map((item) => {
          const part = byId.get(item.productId);
          return {
            key: item.productId,
            name: part?.name ?? item.productId,
            code: part?.sku ?? "",
            type: part?.type ?? "standard",
            subCategory: part?.subCategory ?? "",
            unit: part ? productUnit(part) : "",
            sold: toNumber(item.quantity) * line.sold,
          };
        });
  const toggle = (category: string) =>
    setClosed((old) => {
      const next = new Set(old);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  const allClosed = groups.length > 0 && closed.size === groups.length;

  const title =
    type === "combo"
      ? l(["Product Sales Report (Combo)", "របាយការណ៍លក់មុខទំនិញ (ឈុត)"])
      : type === "simple"
        ? l(["Product Sales Report (Simple)", "របាយការណ៍លក់មុខទំនិញ (ធម្មតា)"])
        : l(["Product Sales Report", "របាយការណ៍លក់មុខទំនិញ"]);

  const exportCsv = () =>
    downloadText(
      `${type ? `product-sales-${type}` : "product-sales"}.csv`,
      toCsv([
        [
          l(["Category", "ប្រភេទ"]),
          l(["Product", "មុខទំនិញ"]),
          l(["Code", "កូដ"]),
          l(["Product Type", "ប្រភេទទំនិញ"]),
          l(["Subcategory", "ប្រភេទរង"]),
          l(["Sold", "បានលក់"]),
          l(["Unit", "ឯកតា"]),
          l(["Unit Price", "តម្លៃឯកតា"]),
          l(["Discount", "បញ្ចុះតម្លៃ"]),
          ...(showCost ? [l(["Total Cost", "ថ្លៃដើមសរុប"])] : []),
          l(["Total Price", "តម្លៃលក់សរុប"]),
          ...(showCost ? [l(["Net Profit", "ប្រាក់ចំណេញសុទ្ធ"])] : []),
        ],
        ...allRows.flatMap((line) => [
          [
            categoryLabel(line.category, language),
            line.name,
            line.code,
            line.type,
            line.subCategory,
            line.sold,
            line.unit,
            line.sold ? Math.round(line.gross / line.sold) : 0,
            Math.round(line.discount),
            ...(showCost ? [Math.round(line.cost)] : []),
            Math.round(net(line)),
            ...(showCost ? [Math.round(profit(line))] : []),
          ],
          ...partsOf(line).map((part) => [
            categoryLabel(line.category, language),
            `  ${part.name}`,
            part.code,
            part.type,
            part.subCategory,
            part.sold,
            part.unit,
          ]),
        ]),
      ]),
    );

  const amounts = (rows: Line[]) => (
    <>
      <td className="align-right">
        {formatMoney(sum(rows, (x) => x.discount))}
      </td>
      {showCost && (
        <td className="align-right">{formatMoney(sum(rows, (x) => x.cost))}</td>
      )}
      <td className="align-right">{formatMoney(sum(rows, net))}</td>
      {showCost && (
        <td
          className={`align-right ${sum(rows, profit) < 0 ? "text-danger" : ""}`}
        >
          {formatMoney(sum(rows, profit))}
        </td>
      )}
    </>
  );

  return (
    <Box
      icon={type === "combo" ? "layers" : "barcode"}
      title={branchTitle(title)}
      intro={l([
        "Please customize the report below. You can download it as CSV or print it.",
        "សូមកំណត់របាយការណ៍ខាងក្រោម។ អ្នកអាចទាញយកជា CSV ឬបោះពុម្ពបាន។",
      ])}
      actions={[
        {
          icon: "eye",
          label: formOpen
            ? l(["Hide Form", "លាក់ទម្រង់"])
            : l(["Show Form", "បង្ហាញទម្រង់"]),
          onClick: () => setFormOpen((open) => !open),
        },
        { icon: "fileExcel", label: t.exportCsv, onClick: exportCsv },
        { icon: "print", label: t.print, onClick: () => window.print() },
      ]}
    >
      {formOpen && (
        <form
          className="report-form"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters(draft);
          }}
        >
          <label>
            {l(["Start date", "ថ្ងៃចាប់ផ្តើម"])}
            <input
              type="date"
              className="form-control"
              value={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
          </label>
          <label>
            {l(["End date", "ថ្ងៃបញ្ចប់"])}
            <input
              type="date"
              className="form-control"
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
          </label>
          {!ownBranch && (
            <label>
              {l(["Branch", "សាខា"])}
              <NativeSelect
                className="form-control"
                value={draft.branch}
                onChange={(event) =>
                  setDraft({ ...draft, branch: event.target.value })
                }
              >
                <option value="">{l(["All branches", "គ្រប់សាខា"])}</option>
                {branches.map((row) => (
                  <option key={row.id} value={String(row.name)}>
                    {String(row.name)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          <label>
            {l(["Category", "ប្រភេទ"])}
            <NativeSelect
              className="form-control"
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
            >
              <option value="">{l(["All categories", "គ្រប់ប្រភេទ"])}</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {categoryLabel(name, language)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label>
            {l(["Sold by", "លក់ដោយ"])}
            <NativeSelect
              className="form-control"
              value={draft.cashier}
              onChange={(event) =>
                setDraft({ ...draft, cashier: event.target.value })
              }
            >
              <option value="">{l(["Everyone", "ទាំងអស់គ្នា"])}</option>
              {cashiers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="report-form-buttons">
            <button className="btn btn-primary" type="submit">
              {l(["Submit", "បង្ហាញ"])}
            </button>
            <button
              className="btn btn-default"
              type="button"
              onClick={() => {
                setDraft(NO_FILTERS);
                setFilters(NO_FILTERS);
              }}
            >
              {l(["Reset", "កំណត់ឡើងវិញ"])}
            </button>
          </div>
        </form>
      )}

      <div className="print-area table-responsive">
        <table className="data-table product-sales-report">
          <thead>
            <tr>
              <th className="group-toggle">
                <button
                  type="button"
                  className="group-dot"
                  aria-label={l(["Open or close all", "បើក ឬបិទទាំងអស់"])}
                  onClick={() =>
                    setClosed(
                      allClosed
                        ? new Set()
                        : new Set(groups.map((group) => group.category)),
                    )
                  }
                >
                  {allClosed ? "+" : "−"}
                </button>
              </th>
              <th>{l(["Category » Product", "ប្រភេទ » មុខទំនិញ"])}</th>
              <th>{l(["Product Type", "ប្រភេទទំនិញ"])}</th>
              <th>{l(["Subcategory", "ប្រភេទរង"])}</th>
              <th className="align-right">{l(["Sold", "បានលក់"])}</th>
              <th className="align-right">{l(["Unit Price", "តម្លៃឯកតា"])}</th>
              <th className="align-right">{l(["Discount", "បញ្ចុះតម្លៃ"])}</th>
              {showCost && (
                <th className="align-right">
                  {l(["Total Cost", "ថ្លៃដើមសរុប"])}
                </th>
              )}
              <th className="align-right">
                {l(["Total Price", "តម្លៃលក់សរុប"])}
              </th>
              {showCost && (
                <th className="align-right">
                  {l(["Net Profit", "ប្រាក់ចំណេញសុទ្ធ"])}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={columns + 1} className="no-data">
                  {l(["No sales found.", "រកមិនឃើញការលក់ទេ។"])}
                </td>
              </tr>
            )}
            {groups.map((group) => {
              const open = !closed.has(group.category);
              return (
                <Fragment key={group.category}>
                  <tr
                    className="category-row"
                    onClick={() => toggle(group.category)}
                  >
                    <td colSpan={columns + 1}>
                      <span className="group-dot">{open ? "−" : "+"}</span>{" "}
                      <b>{categoryLabel(group.category, language)}</b>
                      {!open && (
                        <span className="muted">
                          {" "}
                          ({group.rows.length} ·{" "}
                          {formatMoney(sum(group.rows, net))})
                        </span>
                      )}
                    </td>
                  </tr>
                  {open &&
                    group.rows.map((line, index) => (
                      <Fragment key={line.productId}>
                        <tr>
                          <td className="align-center">{index + 1}</td>
                          <td>
                            {line.name} - {line.code}
                          </td>
                          <td className="align-center">{line.type}</td>
                          <td>{line.subCategory}</td>
                          <td className="align-right">
                            {qty(line)}{" "}
                            <span className="unit">{line.unit}</span>
                          </td>
                          <td className="align-right">
                            {formatMoney(unitPrice(line))}
                          </td>
                          {amounts([line])}
                        </tr>
                        {partsOf(line).map((part) => (
                          <tr key={part.key} className="combo-part-row">
                            <td />
                            <td>
                              {part.name}
                              {part.code && ` - ${part.code}`}
                            </td>
                            <td className="align-center">{part.type}</td>
                            <td>{part.subCategory}</td>
                            <td className="align-right">
                              {formatNumber(part.sold, 3)}{" "}
                              <span className="unit">{part.unit}</span>
                            </td>
                            <td colSpan={columns - 4} />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  {open && (
                    <tr className="subtotal-row">
                      <td colSpan={5} />
                      <td className="align-right">
                        {formatMoney(sum(group.rows, unitPrice))}
                      </td>
                      {amounts(group.rows)}
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan={4} className="align-center">
                  {t.total}
                </td>
                <td className="align-right">
                  {formatNumber(
                    sum(allRows, (x) => x.sold),
                    3,
                  )}
                </td>
                <td className="align-right">
                  {formatMoney(sum(allRows, unitPrice))}
                </td>
                {amounts(allRows)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Box>
  );
}
