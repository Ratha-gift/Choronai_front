"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { IconName } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { Select } from "@/components/ui/select";
import {
  DataTable,
  cellValue,
  type Column,
  type HeaderGroup,
} from "@/components/ui/data-table";
import { useCollection } from "@/data/collections";
import type { Row, Transaction } from "@/data/types";
import { categoriesOf, categoryLabel } from "@/features/products/labels";
import {
  isLowStock,
  productCost,
  productStock,
  productUnit,
  tracksStock,
} from "@/features/products/store";
import type { Product } from "@/features/products/types";
import { useSettings } from "@/features/settings/store";
import { useLanguage, type Label } from "@/i18n";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useReportData } from "./use-report-data";

const DAY = 86_400_000;


const c = (
  key: string,
  en: string,
  km: string,
  type?: Column<Row>["type"],
  extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, label: [en, km], type, ...extra });

const unit = (row: Row) => String(row.unit ?? "");

function ReportTable({
  icon,
  title,
  intro,
  columns,
  rows,
  headerGroups,
  initialSort,
  file,
  toolbar,
}: {
  icon: IconName;
  title: Label;
  intro?: Label;
  columns: Column<Row>[];
  rows: Row[];
  headerGroups?: HeaderGroup[];
  initialSort?: { key: string; desc?: boolean };
  file: string;
  /** Extra controls shown next to the search box and Filter button. */
  toolbar?: ReactNode;
}) {
  const { l, t } = useLanguage();
  return (
    <Box
      icon={icon}
      title={l(title)}
      intro={intro ? l(intro) : t.reportIntro}
      actions={[
        {
          icon: "fileExcel",
          label: t.exportCsv,
          onClick: () =>
            downloadText(
              `${file}.csv`,
              toCsv([
                columns.map((column) => l(column.label)),
                ...rows.map((row) =>
                  columns.map((column) => {
                    const value = cellValue(column, row);
                    return column.type === "date" || column.type === "datetime"
                      ? formatDate(value, column.type === "datetime")
                      : value;
                  }),
                ),
              ]),
            ),
        },
        { icon: "print", label: t.print, onClick: () => window.print() },
      ]}
    >
      <div className="print-area grid-lines">
        <DataTable
          columns={columns}
          rows={rows}
          selectable={false}
          headerGroups={headerGroups}
          initialSort={initialSort}
          toolbar={toolbar}
        />
      </div>
    </Box>
  );
}

export function QuantityAlerts() {
  const { products } = useReportData();
  const rows = products.filter(isLowStock).map((product) => ({
    id: product.id,
    image: product.image,
    code: product.sku,
    name: product.name,
    quantity: productStock(product),
    alert: product.alertQuantity ?? 0,
    toAdd: Math.max(0, (product.alertQuantity ?? 0) - productStock(product)),
    unit: productUnit(product),
  }));
  return (
    <ReportTable
      icon="calendar"
      file="quantity-alerts"
      title={[
        "Product Quantity Alerts (All Warehouses)",
        "សញ្ញាព្រមានបរិមាណ (គ្រប់ឃ្លាំង)",
      ]}
      rows={rows}
      columns={[
        c("image", "Image", "រូបភាព", "image", { sortable: false }),
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("quantity", "Quantity", "បរិមាណ", "qty", { unit }),
        c("alert", "Alert Quantity", "បរិមាណព្រមាន", "qty", { unit }),
        c("toAdd", "Quantity to Add", "បរិមាណត្រូវបន្ថែម", "qty", { unit }),
      ]}
    />
  );
}

/** Received lines with an expiry date, newest batches first. */
function useExpiryRows() {
  const { stockReceives } = useReportData();
  return stockReceives.flatMap((receive) =>
    receive.items
      .filter((line) => line.expiry)
      .map((line, i) => ({
        id: `${receive.id}-${i}`,
        date: receive.date,
        reference: receive.reference,
        code: line.code,
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        warehouse: receive.warehouse,
        expiry: line.expiry,
        daysLeft: Math.ceil(
          (new Date(String(line.expiry)).getTime() - Date.now()) / DAY,
        ),
      })),
  );
}

export function ExpiryAlerts() {
  const rows = useExpiryRows().filter((row) => row.daysLeft <= 30);
  return (
    <ReportTable
      icon="calendar"
      file="expiry-alerts"
      title={[
        "Product Expiry Alerts (All Warehouses)",
        "សញ្ញាព្រមានផុតកំណត់ (គ្រប់ឃ្លាំង)",
      ]}
      intro={[
        "Batches that expire within 30 days, or already expired.",
        "ទំនិញដែលនឹងផុតកំណត់ក្នុង 30 ថ្ងៃ ឬផុតកំណត់រួច។",
      ]}
      rows={rows}
      initialSort={{ key: "expiry" }}
      columns={[
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("quantity", "Quantity", "បរិមាណ", "qty", { unit }),
        c("warehouse", "Warehouse", "ឃ្លាំង"),
        c("expiry", "Expiry Date", "ថ្ងៃផុតកំណត់", "date"),
        c("daysLeft", "Days Left", "ថ្ងៃនៅសល់", "number", {
          render: (row) => (
            <span
              className={
                Number(row.daysLeft) < 0 ? "text-danger" : "text-warning"
              }
            >
              {String(row.daysLeft)}
            </span>
          ),
        }),
      ]}
    />
  );
}

export function InventoryInOutExpiry() {
  const rows = useExpiryRows();
  return (
    <ReportTable
      icon="calendar"
      file="inventory-in-out-expiry"
      title={["Inventory In / Out Expiry", "ស្តុកចូល / ចេញ តាមផុតកំណត់"]}
      rows={rows}
      initialSort={{ key: "expiry" }}
      columns={[
        c("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
        c("reference", "Reference No", "លេខយោង"),
        c("code", "Code", "កូដ"),
        c("name", "Name", "ឈ្មោះ"),
        c("warehouse", "Warehouse", "ឃ្លាំង"),
        c("expiry", "Expiry Date", "ថ្ងៃផុតកំណត់", "date"),
        c("quantity", "Quantity In", "បរិមាណចូល", "qty", { unit, total: true }),
      ]}
    />
  );
}

const amountColumns = (): Column<Row>[] => [
  c("receivedQty", "Received", "បានទទួល", "qty", { total: true }),
  c("soldQty", "Sold", "បានលក់", "qty", { total: true }),
  c("receivedAmount", "Received Cost", "ថ្លៃដើមបានទទួល", "money", {
    total: true,
  }),
  c("soldAmount", "Sold Amount", "ទឹកប្រាក់លក់", "money", { total: true }),
  c("profit", "Profit and/or Loss", "ចំណេញ/ខាត", "money", { total: true }),
];

export function BrandReport() {
  return (
    <ReportTable
      icon="layers"
      file="brand-report"
      title={["Brand Report", "របាយការណ៍ម៉ាក"]}
      intro={[
        "Products are not linked to brands yet, so this report is empty.",
        "មុខទំនិញមិនទាន់ភ្ជាប់នឹងម៉ាកទេ ដូច្នេះរបាយការណ៍នេះទទេ។",
      ]}
      rows={[]}
      columns={[c("brand", "Brand", "ម៉ាក"), ...amountColumns()]}
    />
  );
}

export function CategoriesReport() {
  const { language } = useLanguage();
  const { movements } = useReportData();
  const rows = categoriesOf(movements.map((move) => move.product)).map(
    (category) => {
      const moves = movements.filter(
        (move) => move.product.category === category,
      );
      const total = (pick: (move: (typeof moves)[number]) => number) =>
        moves.reduce((sum, move) => sum + pick(move), 0);
      return {
        id: category,
        code: category,
        name: categoryLabel(category, language),
        receivedQty: total((move) => move.receivedQty),
        soldQty: total((move) => move.soldQty),
        receivedAmount: total((move) => move.receivedAmount),
        soldAmount: total((move) => move.soldAmount),
        profit: total(
          (move) => move.soldAmount - move.soldQty * productCost(move.product),
        ),
      };
    },
  );
  return (
    <ReportTable
      icon="folder"
      file="categories-report"
      title={["Categories Report", "របាយការណ៍ប្រភេទ"]}
      intro={[
        "Profit is sold amount minus the cost of the quantity sold.",
        "ចំណេញ = ទឹកប្រាក់លក់ ដក ថ្លៃដើមនៃបរិមាណដែលលក់។",
      ]}
      rows={rows}
      columns={[
        c("code", "Category Code", "កូដប្រភេទ"),
        c("name", "Category Name", "ឈ្មោះប្រភេទ"),
        ...amountColumns(),
      ]}
    />
  );
}

const ALL = "all";
type Kind = NonNullable<Product["type"]>;
type Line = Transaction["items"][number];
type StoreFigures = { soldQty: number; soldAmount: number; stockQty: number };

const kindOf = (product: Product): Kind => product.type ?? "standard";
const warehouseOf = (record: Transaction) =>
  String(record.warehouse ?? "").trim();

export function ProductsReport() {
  const { l, language } = useLanguage();
  const {
    products,
    movements,
    sales,
    saleReturns,
    adjustments,
    stockReceives,
    stockIssues,
  } = useReportData();
  const warehouseRows = useCollection("warehouses").rows;
  const categoryRows = useCollection("categories").rows;
  const [settings] = useSettings("system");
  const [warehouse, setWarehouse] = useState(ALL);
  const [kind, setKind] = useState(ALL);

  // Records without a store (and opening stock typed on a product) belong to
  // the default store.
  const defaultStore =
    String(settings.defaultWarehouse ?? "").trim() ||
    String(warehouseRows[0]?.name ?? "").trim();

  // One option per warehouse that was created (Warehouses page). When a branch
  // uses the warehouse, its name is shown too: "Branch (Warehouse)".
  const branchRows = useCollection("branches").rows;
  const stores = useMemo(() => {
    const branchOf = new Map<string, string>();
    branchRows.forEach((row) => {
      const warehouseName = String(row.warehouse ?? "").trim();
      if (warehouseName && !branchOf.has(warehouseName))
        branchOf.set(warehouseName, String(row.name ?? "").trim());
    });
    const seen = new Set<string>();
    return warehouseRows
      .map((row) => String(row.name ?? "").trim())
      .filter((name) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map((name) => {
        const branch = branchOf.get(name);
        return { value: name, label: branch ? `${branch} (${name})` : name };
      });
  }, [warehouseRows, branchRows]);

  // If the chosen warehouse was deleted, go back to "All warehouse".
  useEffect(() => {
    if (warehouse !== ALL && !stores.some((store) => store.value === warehouse))
      setWarehouse(ALL);
  }, [warehouse, stores]);

  // Sold and stock for ONE store, from that store's own records.
  const byStore = useMemo(() => {
    if (warehouse === ALL) return null;
    const byId = new Map(products.map((product) => [product.id, product]));
    const map = new Map<string, StoreFigures>();
    const net = new Map<string, number>(); // all stores together
    const figures = (id: string) => {
      const found = map.get(id);
      if (found) return found;
      const fresh = { soldQty: 0, soldAmount: 0, stockQty: 0 };
      map.set(id, fresh);
      return fresh;
    };
    // A combo moves its components' stock; services move nothing.
    const effects = (line: Line, sign: number) => {
      const product = byId.get(line.productId);
      if (!product) return [];
      if (product.type === "combo")
        return (product.comboItems ?? []).map((item) => ({
          productId: item.productId,
          delta: sign * line.quantity * item.quantity,
        }));
      return tracksStock(product)
        ? [{ productId: product.id, delta: sign * line.quantity }]
        : [];
    };
    const run = (
      records: Transaction[],
      sign: (line: Line) => number,
      sold = false,
    ) =>
      records.forEach((record) => {
        const here = (warehouseOf(record) || defaultStore) === warehouse;
        record.items.forEach((line) => {
          effects(line, sign(line)).forEach((effect) => {
            net.set(
              effect.productId,
              (net.get(effect.productId) ?? 0) + effect.delta,
            );
            if (here) figures(effect.productId).stockQty += effect.delta;
          });
          if (here && sold) {
            const f = figures(line.productId);
            f.soldQty += line.quantity;
            f.soldAmount += line.quantity * line.price;
          }
        });
      });
    run(sales, () => -1, true);
    run(saleReturns, () => 1);
    run(adjustments, (line) => (line.type === "subtraction" ? -1 : 1));
    run(stockReceives, () => 1);
    run(stockIssues, () => -1);
    // Stock typed straight onto a product has no record: default store.
    if (warehouse === defaultStore)
      products.forEach((product) => {
        if (!tracksStock(product)) return;
        const opening = productStock(product) - (net.get(product.id) ?? 0);
        if (Math.abs(opening) > 0.0005) figures(product.id).stockQty += opening;
      });
    return map;
  }, [
    warehouse,
    defaultStore,
    products,
    sales,
    saleReturns,
    adjustments,
    stockReceives,
    stockIssues,
  ]);

  // Sold quantity/amount of each product record, counted only from its OWN
  // sales (a combo counts as a combo, a standard product as a standard).
  // Limited to the chosen store, or all stores for "All warehouse".
  const soldFigures = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    sales.forEach((record) => {
      if (
        warehouse !== ALL &&
        (warehouseOf(record) || defaultStore) !== warehouse
      )
        return;
      record.items.forEach((line) => {
        const f = map.get(line.productId) ?? { qty: 0, amount: 0 };
        f.qty += line.quantity;
        f.amount += line.quantity * line.price;
        map.set(line.productId, f);
      });
    });
    return map;
  }, [warehouse, defaultStore, sales]);

  const subcategoryName = (code?: string) => {
    if (!code) return "";
    const row = categoryRows.find((item) => String(item.code) === code);
    return row ? String(row.name) : code;
  };

  // Stock of a standard product (in the chosen store, or everywhere).
  const stockOf = (id: string) => {
    if (byStore) return byStore.get(id)?.stockQty ?? 0;
    const found = products.find((product) => product.id === id);
    return found ? productStock(found) : 0;
  };
  // A combo holds no stock itself: its stock is how many complete sets the
  // components in stock can still make.
  const comboSets = (product: Product) => {
    const items = product.comboItems ?? [];
    if (!items.length) return 0;
    const sets = Math.min(
      ...items.map((item) => stockOf(item.productId) / (item.quantity || 1)),
    );
    return Math.max(0, Math.floor(sets));
  };

  let rows = movements
    .filter((move) => kind === ALL || kindOf(move.product) === kind)
    .map((move) => {
      const store = byStore?.get(move.product.id);
      const sold = soldFigures.get(move.product.id);
      const stockQty =
        kindOf(move.product) === "combo"
          ? comboSets(move.product)
          : byStore
            ? (store?.stockQty ?? 0)
            : productStock(move.product);
      return {
        id: move.product.id,
        code: move.product.sku,
        name: move.product.name,
        category: categoryLabel(move.product.category, language),
        subcategory: subcategoryName(move.product.subCategory),
        unit: productUnit(move.product),
        soldQty: sold?.qty ?? 0,
        soldAmount: sold?.amount ?? 0,
        stockQty,
        stockAmount: stockQty * productCost(move.product),
      };
    });

  // "All types": combo + standard of the SAME code are added into one row.
  // "All warehouse": the same code from different branches is added into one
  // row. Otherwise every product / store is shown on its own.
  const shouldGroupByCode = kind === ALL || warehouse === ALL;
  if (shouldGroupByCode) {
    const grouped = new Map<string, typeof rows[number]>();
    rows.forEach((row) => {
      const existing = grouped.get(row.code);
      if (existing) {
        existing.soldQty += row.soldQty;
        existing.soldAmount += row.soldAmount;
        existing.stockQty += row.stockQty;
        existing.stockAmount += row.stockAmount;
      } else {
        grouped.set(row.code, { ...row });
      }
    });
    rows = Array.from(grouped.values());
  }

  const fileSuffix = [warehouse, kind]
    .filter((part) => part !== ALL)
    .join("-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_");

  return (
    <ReportTable
      icon="barcode"
      file={`products-report${fileSuffix ? `-${fileSuffix}` : ""}`}
      title={["Products Report", "របាយការណ៍មុខទំនិញ"]}
      rows={rows}
      toolbar={
        <>
          <div style={{ minWidth: 180 }}>
            <Select
              value={warehouse}
              onChange={setWarehouse}
              ariaLabel={l(["Store", "ហាង"])}
              options={[
                { value: ALL, label: l(["All warehouse", "គ្រប់ឃ្លាំង"]) },
                ...stores.map((store) => ({
                  value: store.value,
                  label: store.label || store.value,
                })),
              ]}
            />
          </div>
          <div style={{ minWidth: 150 }}>
            <Select
              value={kind}
              onChange={setKind}
              ariaLabel={l(["Type", "ប្រភេទ"])}
              options={[
                { value: ALL, label: l(["All types", "គ្រប់ប្រភេទ"]) },
                { value: "combo", label: "Combo" },
                { value: "standard", label: l(["Standard", "ស្តង់ដារ"]) },
              ]}
            />
          </div>
        </>
      }
      columns={[
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("category", "Category", "ប្រភេទ"),
        c("subcategory", "Subcategory", "ប្រភេទរង"),
        c("soldQty", "Sold", "បានលក់", "qty", { unit, total: true }),
        c("soldAmount", "Sold Amount", "ទឹកប្រាក់លក់", "money", {
          total: true,
        }),
        c("stockQty", "Stock (Qty)", "ស្តុក (បរិមាណ)", "qty", {
          unit,
          total: true,
        }),
        c(
          "stockAmount",
          "Stock Amount (Cost)",
          "តម្លៃស្តុក (ថ្លៃដើម)",
          "money",
          { total: true },
        ),
      ]}
    />
  );
}

export function InventoryInOut() {
  const { language } = useLanguage();
  const { movements } = useReportData();
  const rows = movements.map((move) => {
    const ending = productStock(move.product);
    const inQty = move.saleReturnQty + move.receivedQty + move.adjustIn;
    const outQty = move.soldQty + move.issuedQty + move.adjustOut;
    return {
      id: move.product.id,
      category: categoryLabel(move.product.category, language),
      code: move.product.sku,
      name: move.product.name,
      unit: productUnit(move.product),
      begin: ending - inQty + outQty,
      inSaleReturn: move.saleReturnQty,
      inReceive: move.receivedQty,
      inAdjustment: move.adjustIn,
      outSale: move.soldQty,
      outIssue: move.issuedQty,
      outAdjustment: move.adjustOut,
      ending,
    };
  });
  const qty = (key: string, en: string, km: string) =>
    c(key, en, km, "qty", { unit, total: true });
  return (
    <ReportTable
      icon="calendar"
      file="inventory-in-out"
      title={["Inventory In / Out", "ស្តុកចូល / ចេញ"]}
      intro={[
        "Begin is worked back from current stock and all recorded movements.",
        "ស្តុកដើមគណនាពីស្តុកបច្ចុប្បន្ន និងចលនាដែលបានកត់ត្រា។",
      ]}
      rows={rows}
      headerGroups={[
        { span: 4 },
        { label: ["In", "ចូល"], span: 3 },
        { label: ["Out", "ចេញ"], span: 3 },
        { span: 1 },
      ]}
      columns={[
        c("category", "Category", "ប្រភេទ"),
        c("code", "Code", "កូដ"),
        c("name", "Name", "ឈ្មោះ"),
        qty("begin", "Begin", "ដើមគ្រា"),
        qty("inSaleReturn", "Sale Return", "លក់ត្រឡប់"),
        qty("inReceive", "Stock Receive", "ទទួលស្តុក"),
        qty("inAdjustment", "Adjustment", "កែតម្រូវ"),
        qty("outSale", "Sale", "លក់"),
        qty("outIssue", "Stock Issue", "បញ្ចេញស្តុក"),
        qty("outAdjustment", "Adjustment", "កែតម្រូវ"),
        qty("ending", "Ending", "ចុងគ្រា"),
      ]}
    />
  );
}

export function AdjustmentReport() {
  const { adjustments } = useReportData();
  const rows = adjustments.map((record) => ({
    id: record.id,
    date: record.date,
    reference: record.reference,
    warehouse: record.warehouse,
    createdBy: record.createdBy,
    items: record.items.length,
    note: record.note,
    status: record.status,
  }));
  return (
    <ReportTable
      icon="filter"
      file="adjustment-report"
      title={["Adjustment Report", "របាយការណ៍កែសម្រួល"]}
      rows={rows}
      initialSort={{ key: "date", desc: true }}
      columns={[
        c("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
        c("reference", "Reference No", "លេខយោង"),
        c("warehouse", "Warehouse", "ឃ្លាំង"),
        c("createdBy", "Created by", "បង្កើតដោយ"),
        c("items", "Items", "ចំនួនមុខ", "number", { align: "center" }),
        c("note", "Note", "កំណត់ចំណាំ"),
        c("status", "Status", "ស្ថានភាព", "status"),
      ]}
    />
  );
}

export function AdjustmentDetails() {
  const { adjustments } = useReportData();
  const rows = adjustments.flatMap((record) =>
    record.items.map((line, i) => ({
      id: `${record.id}-${i}`,
      date: record.date,
      reference: record.reference,
      code: line.code,
      name: line.name,
      type: line.type,
      quantity: line.quantity,
      unit: line.unit,
      warehouse: record.warehouse,
    })),
  );
  return (
    <ReportTable
      icon="filter"
      file="adjustment-details"
      title={["Adjustment Details Report", "លម្អិតកែសម្រួល"]}
      rows={rows}
      initialSort={{ key: "date", desc: true }}
      columns={[
        c("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
        c("reference", "Reference No", "លេខយោង"),
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("warehouse", "Warehouse", "ឃ្លាំង"),
        c("type", "Type", "ប្រភេទ", "status"),
        c("quantity", "Quantity", "បរិមាណ", "qty", { unit }),
      ]}
    />
  );
}

type SalesRow = {
  key: string;
  code: string;
  name: string;
  type: string;
  subcategory: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number;
  cost: number;
  total: number;
  profit: number;
};
type SalesGroup = { category: string; rows: SalesRow[] };

const BLUE = "#3b82c4";
const GRID = "1px solid rgba(127,127,127,0.35)";
const sum = (rows: SalesRow[], pick: (row: SalesRow) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

type SalesFilter = {
  product: string;
  branch: string;
  category: string;
  salesman: string;
  customer: string;
  warehouse: string;
  start: string;
  end: string;
};
const NO_FILTER: SalesFilter = {
  product: "",
  branch: "",
  category: "",
  salesman: "",
  customer: "",
  warehouse: "",
  start: "",
  end: "",
};
/** yyyy-mm-dd of a date in the user's time zone, to compare whole days. */
const dayKey = (value: unknown) => {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
/** Who made the sale; the record may name them in one of several fields. */
const salesmanOf = (record: Transaction) => {
  const data = record as unknown as Record<string, unknown>;
  for (const key of ["salesman", "createdBy", "user", "cashier", "username"])
    if (data[key]) return String(data[key]);
  return "";
};
const CIRCLE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  borderRadius: "50%",
  fontSize: 10,
  lineHeight: 1,
  cursor: "pointer",
  background: "#222",
  color: "#fff",
  userSelect: "none" as const,
};
const FIELD_LABEL = { fontWeight: 700, marginBottom: 6, display: "block" };

/** Sales grouped by category, one row per product, with a subtotal per group. */
export function ProductSalesReport() {
  const { l, t, language } = useLanguage();
  const { products, sales: allSales } = useReportData();
  const categoryRows = useCollection("categories").rows;
  const warehouseRows = useCollection("warehouses").rows;
  const branchRows = useCollection("branches").rows;
  const [settings] = useSettings("system");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  // One button opens and closes the filter form. "draft" is what is typed;
  // "filter" is what the Search button applied to the table.
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<SalesFilter>(NO_FILTER);
  const [filter, setFilter] = useState<SalesFilter>(NO_FILTER);
  const defaultStore =
    String(settings.defaultWarehouse ?? "").trim() ||
    String(warehouseRows[0]?.name ?? "").trim();

  const sales = useMemo(() => {
    const branchWarehouse = filter.branch
      ? String(
          branchRows.find((row) => String(row.name) === filter.branch)
            ?.warehouse ?? "",
        ).trim()
      : "";
    return allSales.filter((sale) => {
      const store = warehouseOf(sale) || defaultStore;
      const day = dayKey(sale.date);
      if (filter.warehouse && store !== filter.warehouse) return false;
      if (filter.branch && store !== branchWarehouse) return false;
      if (filter.customer && String(sale.customer ?? "") !== filter.customer)
        return false;
      if (filter.salesman && salesmanOf(sale) !== filter.salesman)
        return false;
      if (filter.start && (!day || day < filter.start)) return false;
      if (filter.end && (!day || day > filter.end)) return false;
      return true;
    });
  }, [allSales, filter, branchRows, defaultStore]);

  const choices = (values: string[]) => [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].map((value) => ({ value, label: value }));
  const none = (label: string) => ({ value: "", label });

  const groups = useMemo<SalesGroup[]>(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const subcategoryName = (code?: string) => {
      if (!code) return "";
      const row = categoryRows.find((item) => String(item.code) === code);
      return row ? String(row.name) : code;
    };
    const map = new Map<string, Map<string, SalesRow & { gross: number }>>();
    sales.forEach((sale) =>
      sale.items.forEach((line) => {
        const product = byId.get(line.productId);
        const needle = filter.product.trim().toLowerCase();
        if (
          needle &&
          !`${line.name ?? product?.name ?? ""} ${line.code ?? product?.sku ?? ""}`
            .toLowerCase()
            .includes(needle)
        )
          return;
        if (filter.category && product?.category !== filter.category) return;
        const category = product
          ? categoryLabel(product.category, language)
          : "—";
        const key = String(line.productId ?? line.code);
        const bucket =
          map.get(category) ?? new Map<string, SalesRow & { gross: number }>();
        map.set(category, bucket);
        const row = bucket.get(key) ?? {
          key,
          code: String(line.code ?? product?.sku ?? ""),
          name: String(line.name ?? product?.name ?? ""),
          type: product ? kindOf(product) : "standard",
          subcategory: subcategoryName(product?.subCategory),
          qty: 0,
          unit: String(line.unit ?? (product ? productUnit(product) : "")),
          unitPrice: 0,
          discount: 0,
          cost: 0,
          total: 0,
          profit: 0,
          gross: 0,
        };
        const discount = Number(
          (line as unknown as { discount?: number }).discount ?? 0,
        );
        row.qty += line.quantity;
        row.gross += line.quantity * line.price;
        row.discount += discount;
        row.cost += product ? line.quantity * productCost(product) : 0;
        bucket.set(key, row);
      }),
    );
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        rows: [...items.values()]
          .map(({ gross, ...row }) => {
            const total = gross - row.discount;
            return {
              ...row,
              unitPrice: row.qty ? gross / row.qty : 0,
              total,
              profit: total - row.cost,
            };
          })
          .sort((a, b) => a.code.localeCompare(b.code)),
      }));
  }, [products, sales, categoryRows, language, filter]);

  const toggle = (category: string) =>
    setCollapsed((old) =>
      old.includes(category)
        ? old.filter((item) => item !== category)
        : [...old, category],
    );

  const allRows = groups.flatMap((group) => group.rows);
  const cell = (align: "left" | "right" | "center" = "right") => ({
    padding: "8px 10px",
    textAlign: align,
    border: GRID,
  });
  const head = (align: "left" | "right" | "center" = "right") => ({
    padding: "10px",
    textAlign: align,
    background: BLUE,
    color: "#fff",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    border: "1px solid rgba(255,255,255,0.45)",
  });
  const money = (value: number) => formatMoney(value);
  const totalsCells = (rows: SalesRow[]) => (
    <>
      <td style={cell()} />
      <td style={cell()} />
      <td style={cell()} />
      {[
        sum(rows, (row) => row.unitPrice),
        sum(rows, (row) => row.discount),
        sum(rows, (row) => row.cost),
        sum(rows, (row) => row.total),
        sum(rows, (row) => row.profit),
      ].map((value, index) => (
        <td key={index} style={{ ...cell(), color: BLUE, fontWeight: 700 }}>
          {money(value)}
        </td>
      ))}
    </>
  );

  return (
    <Box
      icon="barcode"
      title={l([
        "Product Sales Report (All Warehouses)",
        "របាយការណ៍លក់មុខទំនិញ (គ្រប់ឃ្លាំង)",
      ])}
      intro={t.reportIntro}
      actions={[
        {
          icon: "eye",
          label: formOpen
            ? l(["Hide Form", "លាក់ទម្រង់"])
            : l(["Show Form", "បង្ហាញទម្រង់"]),
          onClick: () => setFormOpen((open) => !open),
        },
        {
          icon: "fileExcel",
          label: t.exportCsv,
          onClick: () =>
            downloadText(
              "product-sales.csv",
              toCsv([
                [
                  "Category",
                  "Code",
                  "Name",
                  "Product Type",
                  "Subcategory",
                  "Sold",
                  "Unit",
                  "Unit Price",
                  "Discount",
                  "Total Cost",
                  "Total Price",
                  "Net Profit",
                ],
                ...groups.flatMap((group) =>
                  group.rows.map((row) => [
                    group.category,
                    row.code,
                    row.name,
                    row.type,
                    row.subcategory,
                    row.qty,
                    row.unit,
                    row.unitPrice,
                    row.discount,
                    row.cost,
                    row.total,
                    row.profit,
                  ]),
                ),
              ]),
            ),
        },
        { icon: "print", label: t.print, onClick: () => window.print() },
      ]}
    >
      {formOpen && (
        <div style={{ padding: "16px 4px 8px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <label>
              <span style={FIELD_LABEL}>{l(["Product", "មុខទំនិញ"])}</span>
              <input
                className="form-control"
                value={draft.product}
                onChange={(event) =>
                  setDraft((old) => ({ ...old, product: event.target.value }))
                }
              />
            </label>
            <div>
              <span style={FIELD_LABEL}>{l(["Branch", "សាខា"])}</span>
              <Select
                value={draft.branch}
                onChange={(value) => setDraft((old) => ({ ...old, branch: value }))}
                ariaLabel="Branch"
                options={[
                  none(l(["Select Branch", "ជ្រើសរើសសាខា"])),
                  ...choices(branchRows.map((row) => String(row.name ?? ""))),
                ]}
              />
            </div>
            <div>
              <span style={FIELD_LABEL}>{l(["Category", "ប្រភេទ"])}</span>
              <Select
                value={draft.category}
                onChange={(value) =>
                  setDraft((old) => ({ ...old, category: value }))
                }
                ariaLabel="Category"
                options={[
                  none(l(["Select Category", "ជ្រើសរើសប្រភេទ"])),
                  ...categoriesOf(products).map((category) => ({
                    value: category,
                    label: categoryLabel(category, language),
                  })),
                ]}
              />
            </div>
            <div>
              <span style={FIELD_LABEL}>{l(["Salesman", "អ្នកលក់"])}</span>
              <Select
                value={draft.salesman}
                onChange={(value) =>
                  setDraft((old) => ({ ...old, salesman: value }))
                }
                ariaLabel="Salesman"
                options={[
                  none(l(["Select Salesman", "ជ្រើសរើសអ្នកលក់"])),
                  ...choices(allSales.map(salesmanOf)),
                ]}
              />
            </div>
            <div>
              <span style={FIELD_LABEL}>{l(["Customer", "អតិថិជន"])}</span>
              <Select
                value={draft.customer}
                onChange={(value) =>
                  setDraft((old) => ({ ...old, customer: value }))
                }
                ariaLabel="Customer"
                options={[
                  none(l(["Select Customer", "ជ្រើសរើសអតិថិជន"])),
                  ...choices(allSales.map((sale) => String(sale.customer ?? ""))),
                ]}
              />
            </div>
            <div>
              <span style={FIELD_LABEL}>{l(["Warehouse", "ឃ្លាំង"])}</span>
              <Select
                value={draft.warehouse}
                onChange={(value) =>
                  setDraft((old) => ({ ...old, warehouse: value }))
                }
                ariaLabel="Warehouse"
                options={[
                  none(l(["Select Warehouse", "ជ្រើសរើសឃ្លាំង"])),
                  ...choices(warehouseRows.map((row) => String(row.name ?? ""))),
                ]}
              />
            </div>
            <label>
              <span style={FIELD_LABEL}>{l(["Start Date", "ថ្ងៃចាប់ផ្តើម"])}</span>
              <input
                className="form-control"
                type="date"
                value={draft.start}
                onChange={(event) =>
                  setDraft((old) => ({ ...old, start: event.target.value }))
                }
              />
            </label>
            <label>
              <span style={FIELD_LABEL}>{l(["End Date", "ថ្ងៃបញ្ចប់"])}</span>
              <input
                className="form-control"
                type="date"
                value={draft.end}
                onChange={(event) =>
                  setDraft((old) => ({ ...old, end: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setFilter(draft)}
            >
              {l(["Search", "ស្វែងរក"])}
            </button>{" "}
            <button
              className="btn btn-default"
              type="button"
              onClick={() => {
                setDraft(NO_FILTER);
                setFilter(NO_FILTER);
              }}
            >
              {t.reset}
            </button>
          </div>
        </div>
      )}
      <div className="print-area table-responsive">
        <table
          className="data-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: GRID,
          }}
        >
          <thead>
            <tr>
              <th style={{ ...head("center"), width: 44 }}>
                <span
                  role="button"
                  tabIndex={0}
                  title={l(["Collapse / expand all", "បិទ / បើកទាំងអស់"])}
                  onClick={() =>
                    setCollapsed(
                      collapsed.length < groups.length
                        ? groups.map((group) => group.category)
                        : [],
                    )
                  }
                  style={{ ...CIRCLE, background: "#fff", color: BLUE }}
                >
                  {collapsed.length < groups.length ? "▾" : "▸"}
                </span>
              </th>
              <th style={head("center")}>
                {l(["Category » Product", "ប្រភេទ » មុខទំនិញ"])}
              </th>
              <th style={head("center")}>
                {l(["Product Type", "ប្រភេទមុខទំនិញ"])}
              </th>
              <th style={head("center")}>{l(["Subcategory", "ប្រភេទរង"])}</th>
              <th style={head()}>{l(["Sold", "បានលក់"])}</th>
              <th style={head()}>{l(["Unit Price", "តម្លៃឯកតា"])}</th>
              <th style={head()}>{l(["Discount", "បញ្ចុះតម្លៃ"])}</th>
              <th style={head()}>{l(["Total Cost", "ថ្លៃដើមសរុប"])}</th>
              <th style={head()}>{l(["Total Price", "តម្លៃសរុប"])}</th>
              <th style={head()}>{l(["Net Profit", "ចំណេញសុទ្ធ"])}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const closed = collapsed.includes(group.category);
              return [
                <tr
                  key={`${group.category}-head`}
                  onClick={() => toggle(group.category)}
                  style={{
                    cursor: "pointer",
                    background: "rgba(127,127,127,0.12)",
                    fontWeight: 700,
                  }}
                >
                  <td style={cell("left")} colSpan={10}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: 8,
                        textAlign: "left",
                      }}
                    >
                      <span style={CIRCLE}>{closed ? "▸" : "▾"}</span>
                      <span>{group.category}</span>
                    </div>
                  </td>
                </tr>,
                ...(closed
                  ? []
                  : group.rows.map((row, index) => (
                      <tr
                        key={`${group.category}-${row.key}`}
                        style={{
                          background:
                            index % 2 === 1
                              ? "rgba(127,127,127,0.07)"
                              : "transparent",
                        }}
                      >
                        <td style={{ ...cell("center"), width: 44 }}>
                          {index + 1}
                        </td>
                        <td style={cell("left")}>
                          <div style={{ textAlign: "left" }}>
                            {row.name} - {row.code}
                          </div>
                        </td>
                        <td style={cell("center")}>{row.type}</td>
                        <td style={cell("center")}>{row.subcategory}</td>
                        <td style={cell()}>
                          {formatNumber(row.qty, 3)}{" "}
                          <span style={{ color: BLUE }}>{row.unit}</span>
                        </td>
                        <td style={cell()}>{money(row.unitPrice)}</td>
                        <td style={cell()}>{money(row.discount)}</td>
                        <td style={cell()}>{money(row.cost)}</td>
                        <td style={cell()}>{money(row.total)}</td>
                        <td style={cell()}>{money(row.profit)}</td>
                      </tr>
                    ))),
                <tr
                  key={`${group.category}-total`}
                  style={{ background: "rgba(59,130,196,0.08)" }}
                >
                  <td style={cell()} colSpan={2} />
                  {totalsCells(group.rows)}
                </tr>,
              ];
            })}
            {allRows.length === 0 && (
              <tr>
                <td style={cell("center")} colSpan={10}>
                  {t.noDataTable}
                </td>
              </tr>
            )}
            {allRows.length > 0 && (
              <tr style={{ background: "rgba(59,130,196,0.16)" }}>
                <td style={{ ...cell("left"), fontWeight: 700 }} colSpan={4}>
                  {l(["Total", "សរុប"])}
                </td>
                <td style={{ ...cell(), fontWeight: 700 }}>
                  {formatNumber(sum(allRows, (row) => row.qty), 3)}
                </td>
                {[
                  sum(allRows, (row) => row.unitPrice),
                  sum(allRows, (row) => row.discount),
                  sum(allRows, (row) => row.cost),
                  sum(allRows, (row) => row.total),
                  sum(allRows, (row) => row.profit),
                ].map((value, index) => (
                  <td key={index} style={{ ...cell(), fontWeight: 700 }}>
                    {money(value)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
