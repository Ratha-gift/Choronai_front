"use client";
import { useState, type ReactNode } from "react";
import { NativeSelect } from "@/components/ui/select";
import { useCollection } from "@/data/collections";
import { useWarehouseStock } from "@/features/products/warehouse-stock";
import type { IconName } from "@/components/icons";
import { Box } from "@/components/ui/box";
import {
  DataTable,
  cellValue,
  type Column,
  type HeaderGroup,
} from "@/components/ui/data-table";
import type { Row } from "@/data/types";
import { categoriesOf, categoryLabel } from "@/features/products/labels";
import {
  isLowStock,
  productCost,
  productStock,
  productUnit,
} from "@/features/products/store";
import { useLanguage, type Label } from "@/i18n";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import {
  useBranchTitle,
  usePermissions,
} from "@/features/settings/permissions";
import {
  WASTE_REASONS,
  reasonLabel,
  type AdjustReason,
} from "@/features/transactions/reasons";
import { useReportData } from "./use-report-data";
import { appliedStock } from "@/features/transactions/kinds";

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
  /** Extra controls next to the search box (warehouse, type ...). */
  toolbar?: ReactNode;
}) {
  const { l, t } = useLanguage();
  const branchTitle = useBranchTitle();
  return (
    <Box
      icon={icon}
      title={branchTitle(l(title))}
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
      <div className="print-area report-grid">
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
export function useExpiryRows() {
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

/**
 * Stock per batch (product + warehouse + expiry date): what came in with
 * Stock Receive and what went out with approved Stock Adjustments (thrown
 * away, sold off...). Each warehouse keeps its own balance, so goods thrown
 * away in one branch never lower another branch's batch.
 */
export function InventoryInOutExpiry() {
  const { l } = useLanguage();
  const { stockReceives, adjustments } = useReportData();
  type Batch = {
    id: string;
    date: string;
    reference: string;
    branch: string;
    warehouse: string;
    code: string;
    name: string;
    unit: string;
    expiry: string;
    quantityIn: number;
    quantityOut: number;
    reasons: string[];
  };
  const batches = new Map<string, Batch>();
  const batch = (
    record: {
      date: string;
      reference: string;
      branch?: string;
      warehouse?: string;
    },
    line: {
      productId: string;
      code: string;
      name: string;
      unit?: string;
      expiry?: string;
    },
  ) => {
    const key = JSON.stringify([
      line.productId,
      record.warehouse ?? "",
      line.expiry,
    ]);
    let row = batches.get(key);
    if (!row) {
      row = {
        id: key,
        date: record.date,
        reference: record.reference,
        branch: record.branch ?? "",
        warehouse: record.warehouse ?? "",
        code: line.code,
        name: line.name,
        unit: line.unit ?? "kg",
        expiry: String(line.expiry),
        quantityIn: 0,
        quantityOut: 0,
        reasons: [],
      };
      batches.set(key, row);
    }
    return row;
  };
  for (const receive of stockReceives)
    for (const line of receive.items.filter((item) => item.expiry))
      batch(receive, line).quantityIn += line.quantity;
  for (const record of adjustments.filter((row) =>
    appliedStock("adjustment", row),
  ))
    for (const line of record.items.filter((item) => item.expiry)) {
      const row = batch(record, line);
      if (line.type === "subtraction") {
        row.quantityOut += line.quantity;
        const reason = l(reasonLabel(line.reason));
        if (!row.reasons.includes(reason)) row.reasons.push(reason);
      } else row.quantityIn += line.quantity;
    }
  const rows = [...batches.values()].map((row) => ({
    ...row,
    quantityIn: round3(row.quantityIn),
    quantityOut: round3(row.quantityOut),
    balance: round3(row.quantityIn - row.quantityOut),
    reasons: row.reasons.join(", "),
  }));
  return (
    <ReportTable
      icon="calendar"
      file="inventory-in-out-expiry"
      title={["Inventory In / Out Expiry", "ស្តុកចូល / ចេញ តាមផុតកំណត់"]}
      intro={[
        "Each batch is counted in its own branch and warehouse. Out is approved Stock Adjustments (thrown away and other removals) with the batch's expiry date.",
        "ទំនិញនីមួយៗគិតតាមសាខា និងឃ្លាំងរបស់វាផ្ទាល់។ ចេញ = ការកែតម្រូវស្តុកដែលបានអនុម័ត (បោះចោល ។ល។) ដែលមានថ្ងៃផុតកំណត់ដូចគ្នា។",
      ]}
      rows={rows}
      initialSort={{ key: "expiry" }}
      columns={[
        c("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
        c("reference", "Reference No", "លេខយោង"),
        c("branch", "Branch", "សាខា", undefined, { filter: "chips" }),
        c("warehouse", "Warehouse", "ឃ្លាំង", undefined, { filter: "chips" }),
        c("code", "Code", "កូដ"),
        c("name", "Name", "ឈ្មោះ"),
        c("expiry", "Expiry Date", "ថ្ងៃផុតកំណត់", "date"),
        c("quantityIn", "Quantity In", "បរិមាណចូល", "qty", {
          unit,
          total: true,
        }),
        c("quantityOut", "Quantity Out", "បរិមាណចេញ", "qty", {
          unit,
          total: true,
        }),
        c("reasons", "Reason", "មូលហេតុ"),
        c("balance", "Balance", "នៅសល់", "qty", { unit, total: true }),
      ]}
    />
  );
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

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

/**
 * Each product: sold quantity and amount, stock and its value at cost.
 * "All warehouse" adds up every warehouse; one warehouse counts only its
 * sales and its stock. Users kept to their branch see their warehouse.
 */
export function ProductsReport() {
  const { l, language } = useLanguage();
  const { warehouse: ownWarehouse } = usePermissions();
  const { movements, sales } = useReportData();
  const warehouses = useCollection("warehouses").rows;
  const [warehouse, setWarehouse] = useState("");
  const [type, setType] = useState("");
  const inWarehouse = useWarehouseStock(warehouse);

  const sold = new Map<string, { qty: number; amount: number }>();
  for (const sale of sales) {
    if (warehouse && sale.warehouse !== warehouse) continue;
    for (const line of sale.items) {
      const row = sold.get(line.productId) ?? { qty: 0, amount: 0 };
      row.qty += line.quantity;
      row.amount += line.quantity * line.price;
      sold.set(line.productId, row);
    }
  }

  const rows = movements
    .filter((move) => !type || (move.product.type ?? "standard") === type)
    .map((move) => {
      const product = move.product;
      const stockQty = inWarehouse
        ? (inWarehouse.get(product.id) ?? 0)
        : productStock(product);
      return {
        id: product.id,
        code: product.sku,
        name: product.name,
        category: categoryLabel(product.category, language),
        subCategory: product.subCategory ?? "",
        unit: productUnit(product),
        soldQty: sold.get(product.id)?.qty ?? 0,
        soldAmount: sold.get(product.id)?.amount ?? 0,
        stockQty,
        stockAmount: stockQty * productCost(product),
      };
    });

  return (
    <ReportTable
      icon="barcode"
      file={warehouse ? `products-report-${warehouse}` : "products-report"}
      title={["Products Report", "របាយការណ៍មុខទំនិញ"]}
      intro={[
        "Please customize the report below. You can download it as CSV or print it.",
        "សូមកំណត់របាយការណ៍ខាងក្រោម។ អ្នកអាចទាញយកជា CSV ឬបោះពុម្ពបាន។",
      ]}
      rows={rows}
      toolbar={
        <>
          {!ownWarehouse && (
            <NativeSelect
              className="form-control report-toolbar-select"
              value={warehouse}
              onChange={(event) => setWarehouse(event.target.value)}
              aria-label={l(["Warehouse", "ឃ្លាំង"])}
            >
              <option value="">{l(["All warehouse", "គ្រប់ឃ្លាំង"])}</option>
              {warehouses.map((row) => (
                <option key={row.id} value={String(row.name)}>
                  {String(row.name)}
                </option>
              ))}
            </NativeSelect>
          )}
          <NativeSelect
            className="form-control report-toolbar-select"
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label={l(["Product type", "ប្រភេទទំនិញ"])}
          >
            <option value="">{l(["All types", "គ្រប់ប្រភេទ"])}</option>
            <option value="standard">{l(["Standard", "ធម្មតា"])}</option>
            <option value="combo">{l(["Combo", "ឈុត"])}</option>
            <option value="service">{l(["Service", "សេវាកម្ម"])}</option>
          </NativeSelect>
        </>
      }
      columns={[
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("category", "Category", "ប្រភេទ", undefined, { filter: "chips" }),
        c("subCategory", "Subcategory", "ប្រភេទរង"),
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
  const reasonColumn = useReasonColumn();
  const rows = adjustments.flatMap((record) =>
    record.items.map((line, i) => ({
      id: `${record.id}-${i}`,
      date: record.date,
      reference: record.reference,
      code: line.code,
      name: line.name,
      type: line.type,
      reason: line.reason ?? "",
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
        reasonColumn,
        c("quantity", "Quantity", "បរិមាណ", "qty", { unit }),
      ]}
    />
  );
}

/** Reason of an adjustment line, as a filterable column. */
function useReasonColumn(): Column<Row> {
  const { l } = useLanguage();
  return c("reason", "Reason", "មូលហេតុ", undefined, {
    value: (row) => (row.reason ? l(reasonLabel(String(row.reason))) : "—"),
    filter: "chips",
  });
}

/**
 * Products thrown away (spoiled, expired, damaged) through Stock Adjustment,
 * with what they cost. Pending adjustments are listed but not yet counted.
 */
export function WasteReport() {
  const { adjustments, products } = useReportData();
  const reasonColumn = useReasonColumn();
  const costOf = new Map(products.map((p) => [p.id, productCost(p)]));
  const rows = adjustments.flatMap((record) =>
    record.items
      .map((line, i) => ({ line, i }))
      .filter(
        ({ line }) =>
          line.type === "subtraction" &&
          WASTE_REASONS.includes(line.reason as AdjustReason),
      )
      .map(({ line, i }) => {
        const cost = costOf.get(line.productId) ?? 0;
        const approved = record.status !== "pending";
        return {
          id: `${record.id}-${i}`,
          date: record.date,
          reference: record.reference,
          branch: record.branch ?? "",
          warehouse: record.warehouse ?? "",
          code: line.code,
          name: line.name,
          reason: line.reason ?? "",
          description: line.description ?? "",
          quantity: line.quantity,
          unit: line.unit,
          cost,
          // Pending adjustments have not removed stock yet.
          value: approved ? Math.round(cost * line.quantity) : 0,
          status: record.status,
          createdBy: record.createdBy,
        };
      }),
  );
  return (
    <ReportTable
      icon="trash"
      file="waste-report"
      title={[
        "Waste Report (All Warehouses)",
        "របាយការណ៍ទំនិញចោល (គ្រប់ឃ្លាំង)",
      ]}
      intro={[
        "Products thrown away through Stock Adjustment (reason: spoiled, expired or damaged). Value is at product cost; pending adjustments count once approved.",
        "ទំនិញដែលបានចោលតាម Stock Adjustment (មូលហេតុ៖ ខូច ផុតកំណត់ ឬបែក)។ តម្លៃគិតតាមថ្លៃដើម។ ការកែតម្រូវដែលកំពុងរង់ចាំ គិតពេលអនុម័ត។",
      ]}
      rows={rows}
      initialSort={{ key: "date", desc: true }}
      columns={[
        c("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
        c("reference", "Reference No", "លេខយោង"),
        c("branch", "Branch", "សាខា", undefined, { filter: "chips" }),
        c("warehouse", "Warehouse", "ឃ្លាំង", undefined, { filter: "chips" }),
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        reasonColumn,
        c("description", "Description", "ពិពណ៌នា"),
        c("quantity", "Quantity", "បរិមាណ", "qty", { unit, total: true }),
        c("value", "Value (cost)", "តម្លៃ (ថ្លៃដើម)", "money", { total: true }),
        c("status", "Status", "ស្ថានភាព", "status"),
        c("createdBy", "Created by", "បង្កើតដោយ"),
      ]}
    />
  );
}
