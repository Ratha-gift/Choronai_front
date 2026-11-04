import { TransactionDetails } from "@/features/transactions/transaction-details";
import {
  KINDS,
  lineDelta,
  appliedStock,
  type TransactionKind,
} from "@/features/transactions/kinds";
import { adjustStock } from "@/features/products/store";
import type { Row, Transaction } from "@/data/types";
import type { ResourceDef } from "../types";
import { openPaymentDialog } from "@/features/sales/payments";
import { balanceOf, col } from "./helpers";
import { getRows } from "@/data/collections";
import { canPerform } from "@/lib/permissions";

const details = (row: Row) => <TransactionDetails row={row} />;

/** Deleting a stock-moving record puts the stock back. */
const reverseStock = (kind: TransactionKind) => (row: Row) => {
  const def = KINDS[kind];
  const record = row as Transaction;
  if (!appliedStock(kind, record)) return;
  if (def.stock === 0 && def.price !== "none") return;
  adjustStock(
    record.items.map((line) => ({
      productId: line.productId,
      delta: -lineDelta(def, line),
      location: record,
    })),
  );
};

const stockFilters = {
  branch: "branches",
  toBranch: "branches",
  warehouse: "warehouses",
  createdBy: "users",
} as const;
const saleFilters = { ...stockFilters, customer: "customers" } as const;

const date = col("date", "Date", "កាលបរិច្ឆេទ", "datetime");
const reference = col("reference", "Reference No", "លេខយោង");
const referenceTo = col("referenceTo", "Reference No To", "យោងទៅ");
const grandTotal = col("grandTotal", "Grand Total", "សរុប", "money", {
  total: true,
});
const returned = col("returned", "Returned", "ត្រឡប់", "money", {
  total: true,
});
const paid = col("paid", "Paid", "បានបង់", "money", { total: true });
const balance = col("balance", "Balance", "នៅខ្វះ", "money", {
  total: true,
  value: balanceOf,
});
const paymentStatus = col(
  "paymentStatus",
  "Payment Status",
  "ស្ថានភាពទូទាត់",
  "status",
);
const status = col("status", "Status", "ស្ថានភាព", "status");
const sortByDate = { key: "date", desc: true };

export const transactionResources: ResourceDef[] = [
  {
    id: "sales/registers",
    collection: "registers",
    canDelete: () => false,
    rowClassName: (row) => (row.status === "open" ? "register-open" : ""),
    title: ["Registers (cashier shifts)", "បញ្ជរគិតលុយ (វេនអ្នកគិតលុយ)"],
    branchOf: (row) => [row.warehouse],
    noun: ["Register", "បញ្ជរ"],
    icon: "lock",
    initialSort: { key: "openedAt", desc: true },
    canEdit: false,
    columns: [
      col("openedAt", "Opened", "បើក", "datetime"),
      col("closedAt", "Closed", "បិទ", "datetime"),
      col("username", "Cashier", "អ្នកគិតលុយ"),
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("cashInHand", "Cash in hand", "សាច់ប្រាក់ដើម", "money"),
      col("totalSales", "Total Sales", "លក់សរុប", "money", { total: true }),
      col("invoices", "Invoices", "វិក្កយបត្រ", "number", { total: true }),
      col("expectedCash", "Expected Cash", "សាច់ប្រាក់គួរមាន", "money"),
      col("countedTotal", "Counted", "រាប់បាន", "money"),
      col("difference", "Difference", "ខុសគ្នា", "money", { total: true }),
      col("note", "Note", "កំណត់ចំណាំ"),
      status,
    ],
  },
  {
    id: "sales/pos-sales",
    collection: "sales",
    canDelete: () => false,
    title: [
      "POS Sales (All Branches) (All Warehouses)",
      "ការលក់ POS (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Sale", "ការលក់"],
    icon: "heart",
    addHref: "/pos",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: (row) => {
      // A deleted sale returns its items to stock.
      adjustStock(
        (row as Transaction).items.map((line) => ({
          productId: line.productId,
          delta: line.quantity,
          location: row as Transaction,
        })),
      );
    },
    // Same order as WeERP: details, payments, edit, return, delete.
    menuItems: (row, { navigate, l }) => [
      {
        icon: "money",
        label: l(["View Payments", "មើលការទូទាត់"]),
        onClick: () => openPaymentDialog({ kind: "view", saleId: row.id }),
      },
      {
        icon: "plus",
        label: l(["Add Payment", "បន្ថែមការទូទាត់"]),
        onClick: () => openPaymentDialog({ kind: "add", saleId: row.id }),
      },
      {
        icon: "edit",
        label: l(["Edit Sale", "កែការលក់"]),
        onClick: () => navigate(`/sales/pos-sales/edit/${row.id}`),
      },
      {
        icon: "undo",
        label: l(["Return Sale", "លក់ត្រឡប់"]),
        onClick: () =>
          navigate(
            `/sales/returns/add?sale=${encodeURIComponent(String(row.reference))}`,
          ),
      },
    ],
    filterFrom: saleFilters,
    branchOf: (row) => [row.branch],
    columns: [
      date,
      reference,
      col("branch", "Branch", "សាខា"),
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("customer", "Customer", "អតិថិជន"),
      grandTotal,
      returned,
      paid,
      col("discount", "Discount", "បញ្ចុះតម្លៃ", "money", { total: true }),
      balance,
      paymentStatus,
      col("createdBy", "Created by", "បង្កើតដោយ"),
    ],
  },
  {
    id: "sales/returns",
    collection: "saleReturns",
    canDelete: () => false,
    title: [
      "Returns (All Branches) (All Warehouses)",
      "ការលក់ត្រឡប់ (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Return", "ការត្រឡប់"],
    icon: "undo",
    addHref: "/sales/returns/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: reverseStock("sale-return"),
    filterFrom: saleFilters,
    branchOf: (row) => [row.branch],
    columns: [
      date,
      reference,
      referenceTo,
      col("branch", "Branch", "សាខា"),
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("customer", "Customer", "អតិថិជន"),
      col("grandTotal", "Total Return", "សរុបត្រឡប់", "money", { total: true }),
      paid,
      balance,
      paymentStatus,
      col("createdBy", "Created by", "បង្កើតដោយ"),
    ],
  },
  {
    id: "inventory/stock-receive",
    collection: "stockReceives",
    canDelete: (row) => !row.transferId,
    title: [
      "Stock Receive (All Branches) (All Warehouses)",
      "ទទួលស្តុក (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Stock Receive", "ការទទួលស្តុក"],
    icon: "download",
    addHref: "/inventory/stock-receive/add",
    initialSort: sortByDate,
    details,
    editHref: (row) => `/inventory/stock-receive/edit/${row.id}`,
    onDelete: reverseStock("stock-receive"),
    branchOf: (row) => [row.branch],
    filterFrom: stockFilters,
    columns: [
      date,
      reference,
      col("branch", "Branch", "សាខា"),
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("grandTotal", "Total Cost", "ថ្លៃដើមសរុប", "money", { total: true }),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("note", "Note", "កំណត់ចំណាំ"),
    ],
  },
  {
    id: "inventory/stock-issue",
    collection: "stockIssues",
    canDelete: (row) =>
      !getRows("stockReceives").some(
        (receipt) => receipt.transferId === row.id,
      ),
    menuItems: (row, { navigate, l }) =>
      row.toBranch && row.status !== "received"
        ? [
            {
              icon: "download",
              label: l(["Receive transfer", "ទទួលការផ្ទេរ"]),
              onClick: () =>
                navigate(
                  `/inventory/stock-receive/add?issue=${encodeURIComponent(row.id)}`,
                ),
            },
          ]
        : [],
    title: [
      "Stock Issue (All Branches) (All Warehouses)",
      "បញ្ចេញស្តុក (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Stock Issue", "ការបញ្ចេញស្តុក"],
    icon: "upload",
    addHref: "/inventory/stock-issue/add",
    initialSort: sortByDate,
    details,
    editHref: (row) => `/inventory/stock-issue/edit/${row.id}`,
    onDelete: reverseStock("stock-issue"),
    // Goods leaving or arriving at the branch.
    branchOf: (row) => [row.branch, row.toBranch],
    filterFrom: stockFilters,
    columns: [
      date,
      reference,
      col("branch", "From Branch", "ពីសាខា"),
      col("toBranch", "To Branch", "ទៅសាខា"),
      col("toWarehouse", "Destination warehouse", "ឃ្លាំងគោលដៅ"),
      status,
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("grandTotal", "Total Cost", "ថ្លៃដើមសរុប", "money", { total: true }),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("note", "Note", "កំណត់ចំណាំ"),
    ],
  },
  {
    id: "inventory/stock-adjustment",
    collection: "adjustments",
    canDelete: (row) =>
      row.status !== "approved" || canPerform("stock.approve"),
    title: [
      "Stock Adjustment (All Branches) (All Warehouses)",
      "កែតម្រូវស្តុក (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Stock Adjustment", "ការកែតម្រូវស្តុក"],
    icon: "filter",
    addHref: "/inventory/stock-adjustment/add",
    initialSort: sortByDate,
    details,
    editHref: (row) => `/inventory/stock-adjustment/edit/${row.id}`,
    onDelete: reverseStock("adjustment"),
    branchOf: (row) => [row.branch],
    filterFrom: stockFilters,
    columns: [
      date,
      reference,
      col("branch", "Branch", "សាខា"),
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("note", "Note", "កំណត់ចំណាំ"),
      status,
    ],
  },
];
