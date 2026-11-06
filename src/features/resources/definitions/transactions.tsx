import { TransactionDetails } from "@/features/transactions/transaction-details";
import {
  KINDS,
  lineDelta,
  appliedStock,
  canReceiveTransfer,
  type TransactionKind,
} from "@/features/transactions/kinds";
import { adjustStock } from "@/features/products/store";
import type { Row, Transaction } from "@/data/types";
import type { ResourceDef } from "../types";
import type { Label } from "@/i18n";
import type { MenuItem } from "@/components/ui/action-menu";
import { currentUsername } from "@/lib/auth";
import { openPaymentDialog } from "@/features/sales/payments";
import { balanceOf, col } from "./helpers";
import { getRows, setRows } from "@/data/collections";
import { stockAt, getProducts } from "@/features/products/store";
import { notify } from "@/lib/toast";
import { canPerform } from "@/lib/permissions";
import { usesLaravel } from "@/lib/sync";

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

/**
 * Approving a pending Stock Issue or Stock Adjustment applies its stock
 * change; it is refused when stock would go below zero.
 */
function approve(
  kind: "stock-issue" | "adjustment",
  row: Transaction,
  l: (label: Label) => string,
) {
  const def = KINDS[kind];
  const products = getProducts();
  const short = row.items.some((line) => {
    const product = products.find((item) => item.id === line.productId);
    return !product || stockAt(product, row) + lineDelta(def, line) < 0;
  });
  if (short) {
    notify(
      l([
        "Not enough stock in the warehouse.",
        "ស្តុកក្នុងឃ្លាំងមិនគ្រប់គ្រាន់។",
      ]),
      "error",
    );
    return;
  }
  setRows(def.collection, (rows) =>
    rows.map((item) =>
      item.id === row.id
        ? {
            ...item,
            status: kind === "adjustment" ? "approved" : "accepted",
            stockApplied: true,
            approvedBy: currentUsername(),
            approvedAt: new Date().toISOString(),
          }
        : item,
    ),
  );
  adjustStock(
    row.items.map((line) => ({
      productId: line.productId,
      delta: lineDelta(def, line),
      location: row,
    })),
  );
}

/** Accept / Reject actions for a pending record. */
const approvalItems = (
  kind: "stock-issue" | "adjustment",
  row: Row,
  l: (label: Label) => string,
): MenuItem[] =>
  row.status === "pending" && canPerform("stock.approve")
    ? [
        {
          icon: "check",
          label: l(
            kind === "adjustment"
              ? ["Approve", "អនុម័ត"]
              : ["Accept", "ទទួលយក"],
          ),
          onClick: () => approve(kind, row as Transaction, l),
        },
        {
          icon: "x",
          label: l(["Reject", "បដិសេធ"]),
          onClick: () =>
            setRows(KINDS[kind].collection, (rows) =>
              rows.map((item) =>
                item.id === row.id
                  ? { ...item, status: "rejected", stockApplied: false }
                  : item,
              ),
            ),
        },
      ]
    : [];

const stockFilters = {
  branch: "branches",
  supplier: "suppliers",
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
      // Group Permissions: Payments, Edit, Return Sales.
      ...(canPerform("sales.payments")
        ? [
            {
              icon: "plus" as const,
              label: l(["Add Payment", "បន្ថែមការទូទាត់"]),
              onClick: () => openPaymentDialog({ kind: "add", saleId: row.id }),
            },
          ]
        : []),
      // Laravel keeps posted sales as they are (correct them with a return).
      ...(canPerform("sales.edit") && !usesLaravel()
        ? [
            {
              icon: "edit" as const,
              label: l(["Edit Sale", "កែការលក់"]),
              onClick: () => navigate(`/sales/pos-sales/edit/${row.id}`),
            },
          ]
        : []),
      ...(canPerform("sales.returns")
        ? [
            {
              icon: "undo" as const,
              label: l(["Return Sale", "លក់ត្រឡប់"]),
              onClick: () =>
                navigate(
                  `/sales/returns/add?sale=${encodeURIComponent(String(row.reference))}`,
                ),
            },
          ]
        : []),
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
      col("supplier", "Supplier", "អ្នកផ្គត់ផ្គង់"),
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
      row.status === "pending"
        ? approvalItems("stock-issue", row, l)
        : canReceiveTransfer(row)
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
    menuItems: (row, { l }) => approvalItems("adjustment", row, l),
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
