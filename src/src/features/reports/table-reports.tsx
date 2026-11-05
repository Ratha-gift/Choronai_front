"use client";
import { useMemo, useState, type ReactNode } from "react";
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
import { formatDate } from "@/lib/format";
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
      <div className="print-area">
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

  const stores = useMemo(() => {
    // ឧទាហរណ៍៖ បញ្ជីឈ្មោះឃ្លាំង ឬហាងដែលបានបន្ថែមចូលក្នុងប្រអប់ Dropdown
    const extraStores = [
      "All warehouse",
      "Cold room",
      "Showroom",
      "Branch 2 (សាខាទី ២)",
      "ឃ្លាំងទំនិញខូច (Damaged)",
    ];

    const names = [
      ...extraStores,
      ...warehouseRows.map((row) => String(row.name ?? "").trim()),
    ];
    [sales, saleReturns, adjustments, stockReceives, stockIssues]
      .flat()
      .forEach((record) => names.push(warehouseOf(record)));
    return [...new Set(names.map((n) => n.trim()).filter((name) => name !== ""))];
  }, [warehouseRows, sales, saleReturns, adjustments, stockReceives, stockIssues]);

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

  const rows = movements
    .filter((move) => kind === ALL || kindOf(move.product) === kind)
    .map((move) => {
      const store = byStore?.get(move.product.id);
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
        soldQty: byStore ? (store?.soldQty ?? 0) : move.soldQty,
        soldAmount: byStore ? (store?.soldAmount ?? 0) : move.soldAmount,
        stockQty,
        stockAmount: stockQty * productCost(move.product),
      };
    });

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
                { value: ALL, label: l(["All stores", "គ្រប់ហាង"]) },
                ...stores.map((name) => ({ value: name, label: name })),
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

export function ProductSalesReport() {
  const { sales } = useReportData();
  const rows = sales.flatMap((sale) =>
    sale.items.map((line, i) => ({
      id: `${sale.id}-${i}`,
      date: sale.date,
      reference: sale.reference,
      customer: sale.customer,
      code: line.code,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      price: line.price,
      subtotal: line.price * line.quantity,
    })),
  );
  return (
    <ReportTable
      icon="barcode"
      file="product-sales"
      title={["Product Sales Report", "របាយការណ៍លក់មុខទំនិញ"]}
      rows={rows}
      initialSort={{ key: "date", desc: true }}
      columns={[
        c("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
        c("reference", "Reference No", "លេខយោង"),
        c("customer", "Customer", "អតិថិជន"),
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("quantity", "Quantity", "បរិមាណ", "qty", { unit, total: true }),
        c("price", "Unit Price", "តម្លៃឯកតា", "money"),
        c("subtotal", "Subtotal", "សរុបរង", "money", { total: true }),
      ]}
    />
  );
}