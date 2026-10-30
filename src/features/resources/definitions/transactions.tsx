import { TransactionDetails } from "@/features/transactions/transaction-details";
import {
  KINDS,
  lineDelta,
  type TransactionKind,
} from "@/features/transactions/kinds";
import { adjustStock } from "@/features/products/store";
import type { Row, Transaction } from "@/data/types";
import type { ResourceDef } from "../types";
import { balanceOf, col } from "./helpers";

const details = (row: Row) => <TransactionDetails row={row} />;

/** Deleting a stock-moving record puts the stock back. */
const reverseStock = (kind: TransactionKind) => (row: Row) => {
  const def = KINDS[kind];
  const record = row as Transaction;
  if (def.stock === 0 && def.price !== "none") return;
  if (kind === "purchase" && record.status !== "received") return;
  adjustStock(
    record.items.map((line) => ({
      productId: line.productId,
      delta: -lineDelta(def, line),
    })),
  );
};

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
    title: ["Registers (cashier shifts)", "បញ្ជរគិតលុយ (វេនអ្នកគិតលុយ)"],
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
        })),
      );
    },
    menuItems: (_row, { navigate, l }) => [
      {
        icon: "undo",
        label: l(["Return Sale", "លក់ត្រឡប់"]),
        onClick: () => navigate("/sales/returns/add"),
      },
    ],
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
    ],
  },
  {
    id: "sales/returns",
    collection: "saleReturns",
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
    columns: [
      date,
      reference,
      referenceTo,
      col("customer", "Customer", "អតិថិជន"),
      col("grandTotal", "Total Return", "សរុបត្រឡប់", "money", { total: true }),
      paid,
      balance,
      paymentStatus,
    ],
  },
  {
    id: "purchases/requests",
    collection: "purchaseRequests",
    title: ["Purchase Requests (All Branches)", "សំណើទិញ (គ្រប់សាខា)"],
    noun: ["Purchase Request", "សំណើទិញ"],
    icon: "star",
    addHref: "/purchases/requests/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    columns: [
      date,
      reference,
      col("supplier", "Supplier", "អ្នកផ្គត់ផ្គង់"),
      grandTotal,
      status,
    ],
  },
  {
    id: "purchases/orders",
    collection: "purchaseOrders",
    title: ["Purchase Orders (All Branches)", "បញ្ជាទិញ (គ្រប់សាខា)"],
    noun: ["Purchase Order", "បញ្ជាទិញ"],
    icon: "star",
    addHref: "/purchases/orders/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    columns: [
      date,
      reference,
      col("supplier", "Supplier", "អ្នកផ្គត់ផ្គង់"),
      grandTotal,
      status,
    ],
  },
  {
    id: "purchases/list",
    collection: "purchases",
    title: [
      "Purchases (All Branches) (All Warehouses)",
      "ការទិញ (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Purchase", "ការទិញ"],
    icon: "star",
    addHref: "/purchases/list/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: reverseStock("purchase"),
    menuItems: (_row, { navigate, l }) => [
      {
        icon: "undo",
        label: l(["Return Purchase", "ទិញត្រឡប់"]),
        onClick: () => navigate("/purchases/returns/add"),
      },
    ],
    columns: [
      date,
      reference,
      col("supplier", "Supplier", "អ្នកផ្គត់ផ្គង់"),
      grandTotal,
      returned,
      paid,
      balance,
      col("status", "Purchase Status", "ស្ថានភាពទិញ", "status"),
      paymentStatus,
    ],
  },
  {
    id: "purchases/returns",
    collection: "purchaseReturns",
    title: [
      "Purchase Returns (All Branches) (All Warehouses)",
      "ការទិញត្រឡប់ (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Purchase Return", "ការទិញត្រឡប់"],
    icon: "undo",
    addHref: "/purchases/returns/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: reverseStock("purchase-return"),
    columns: [
      date,
      reference,
      referenceTo,
      col("supplier", "Supplier", "អ្នកផ្គត់ផ្គង់"),
      col("grandTotal", "Total Return", "សរុបត្រឡប់", "money", { total: true }),
      paid,
      balance,
      paymentStatus,
    ],
  },
  {
    id: "inventory/stock-receive",
    collection: "stockReceives",
    title: [
      "Stock Receive (All Branches) (All Warehouses)",
      "ទទួលស្តុក (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Stock Receive", "ការទទួលស្តុក"],
    icon: "download",
    addHref: "/inventory/stock-receive/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: reverseStock("stock-receive"),
    columns: [
      date,
      reference,
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("grandTotal", "Total Cost", "ថ្លៃដើមសរុប", "money", { total: true }),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("note", "Note", "កំណត់ចំណាំ"),
    ],
  },
  {
    id: "inventory/stock-issue",
    collection: "stockIssues",
    title: [
      "Stock Issue (All Branches) (All Warehouses)",
      "បញ្ចេញស្តុក (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Stock Issue", "ការបញ្ចេញស្តុក"],
    icon: "upload",
    addHref: "/inventory/stock-issue/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: reverseStock("stock-issue"),
    columns: [
      date,
      reference,
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("grandTotal", "Total Cost", "ថ្លៃដើមសរុប", "money", { total: true }),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("note", "Note", "កំណត់ចំណាំ"),
    ],
  },
  {
    id: "inventory/stock-adjustment",
    collection: "adjustments",
    title: [
      "Stock Adjustment (All Branches) (All Warehouses)",
      "កែតម្រូវស្តុក (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Stock Adjustment", "ការកែតម្រូវស្តុក"],
    icon: "filter",
    addHref: "/inventory/stock-adjustment/add",
    initialSort: sortByDate,
    details,
    canEdit: false,
    onDelete: reverseStock("adjustment"),
    columns: [
      date,
      reference,
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("note", "Note", "កំណត់ចំណាំ"),
      status,
    ],
  },
];
