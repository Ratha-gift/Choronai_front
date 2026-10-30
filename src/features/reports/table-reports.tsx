"use client";
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
}: {
  icon: IconName;
  title: Label;
  intro?: Label;
  columns: Column<Row>[];
  rows: Row[];
  headerGroups?: HeaderGroup[];
  initialSort?: { key: string; desc?: boolean };
  file: string;
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

/** Purchase lines with an expiry date, newest batches first. */
function useExpiryRows() {
  const { purchases } = useReportData();
  return purchases.flatMap((purchase) =>
    purchase.items
      .filter((line) => line.expiry)
      .map((line, i) => ({
        id: `${purchase.id}-${i}`,
        date: purchase.date,
        reference: purchase.reference,
        code: line.code,
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        warehouse: purchase.warehouse,
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
  c("purchasedQty", "Purchased", "បានទិញ", "qty", { total: true }),
  c("soldQty", "Sold", "បានលក់", "qty", { total: true }),
  c("purchasedAmount", "Purchased Amount", "ទឹកប្រាក់ទិញ", "money", {
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
        purchasedQty: total((move) => move.purchasedQty),
        soldQty: total((move) => move.soldQty),
        purchasedAmount: total((move) => move.purchasedAmount),
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

export function ProductsReport() {
  const { language } = useLanguage();
  const { movements } = useReportData();
  const rows = movements.map((move) => ({
    id: move.product.id,
    code: move.product.sku,
    name: move.product.name,
    category: categoryLabel(move.product.category, language),
    unit: productUnit(move.product),
    purchasedQty: move.purchasedQty,
    purchasedAmount: move.purchasedAmount,
    soldQty: move.soldQty,
    soldAmount: move.soldAmount,
    stockQty: productStock(move.product),
    stockAmount: productStock(move.product) * productCost(move.product),
  }));
  return (
    <ReportTable
      icon="barcode"
      file="products-report"
      title={["Products Report", "របាយការណ៍មុខទំនិញ"]}
      rows={rows}
      columns={[
        c("code", "Product Code", "កូដមុខទំនិញ"),
        c("name", "Product Name", "ឈ្មោះមុខទំនិញ"),
        c("category", "Category", "ប្រភេទ"),
        c("purchasedQty", "Purchased", "បានទិញ", "qty", { unit, total: true }),
        c("purchasedAmount", "Purchased Amount", "ទឹកប្រាក់ទិញ", "money", {
          total: true,
        }),
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
    const inQty =
      move.purchasedQty + move.saleReturnQty + move.receivedQty + move.adjustIn;
    const outQty =
      move.purchaseReturnQty + move.soldQty + move.issuedQty + move.adjustOut;
    return {
      id: move.product.id,
      category: categoryLabel(move.product.category, language),
      code: move.product.sku,
      name: move.product.name,
      unit: productUnit(move.product),
      begin: ending - inQty + outQty,
      inPurchase: move.purchasedQty,
      inSaleReturn: move.saleReturnQty,
      inReceive: move.receivedQty,
      inAdjustment: move.adjustIn,
      outPurchaseReturn: move.purchaseReturnQty,
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
        { label: ["In", "ចូល"], span: 4 },
        { label: ["Out", "ចេញ"], span: 4 },
        { span: 1 },
      ]}
      columns={[
        c("category", "Category", "ប្រភេទ"),
        c("code", "Code", "កូដ"),
        c("name", "Name", "ឈ្មោះ"),
        qty("begin", "Begin", "ដើមគ្រា"),
        qty("inPurchase", "Purchase", "ទិញ"),
        qty("inSaleReturn", "Sale Return", "លក់ត្រឡប់"),
        qty("inReceive", "Stock Receive", "ទទួលស្តុក"),
        qty("inAdjustment", "Adjustment", "កែតម្រូវ"),
        qty("outPurchaseReturn", "Purchase Return", "ទិញត្រឡប់"),
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
