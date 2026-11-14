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
import { openPaymentDialog, amountDue } from "@/features/sales/payments";
import { openSaleReceipt } from "@/features/sales/sale-receipt";
import { pick } from "@/i18n";
import type { Language } from "@/i18n";
import { readStored } from "@/lib/store";
import { balanceOf, col } from "./helpers";
import { getRows, setRows } from "@/data/collections";
import { stockAt, getProducts } from "@/features/products/store";
import { notify } from "@/lib/toast";
import { canPerform } from "@/lib/permissions";
import { usesLaravel } from "@/lib/sync";

const details = (row: Row) => <TransactionDetails row={row} />;

/** Resolve a label outside a React component (for toasts). */
const tr = (label: Label) =>
  pick(label, readStored<Language>("choronai-language", "en"));

/** Only a fully paid invoice can be printed (a return counts as paid). */
function printReceipt(row: Row) {
  if (amountDue(row as Transaction) > 0) {
    notify(
      tr([
        "Pay the invoice in full before printing the receipt.",
        "សូមទូទាត់វិក្កយបត្រឱ្យគ្រប់ចំនួន មុននឹងបោះពុម្ពវិក្កយបត្រ។",
      ]),
      "error",
    );
    return;
  }
  openSaleReceipt(row.id);
}

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
  receivingBranch = false,
) {
  const def = KINDS[kind];
  // The receiving branch accepting its own incoming transfer completes it in
  // one step. It cannot see the sending warehouse's stock, so skip that check
  // and credit its own warehouse; the server moves both ends on sync.
  if (receivingBranch) {
    setRows(def.collection, (rows) =>
      rows.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: "received",
              stockApplied: true,
              approvedBy: currentUsername(),
              approvedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    const destination = {
      branch: String(row.toBranch ?? ""),
      warehouse: String((row as Record<string, unknown>).toWarehouse ?? ""),
    };
    // A transfer moves stock both ways: take it out of the sending warehouse
    // and put it into the receiving one, so each branch's balance is right.
    adjustStock([
      ...row.items.map((line) => ({
        productId: line.productId,
        delta: lineDelta(def, line),
        location: row,
      })),
      ...row.items.map((line) => ({
        productId: line.productId,
        delta: line.quantity,
        location: destination,
      })),
    ]);
    return;
  }
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
  receivingBranch = false,
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
          onClick: () => approve(kind, row as Transaction, l, receivingBranch),
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
// On the POS Sales list a return refunds the customer, so show the money the
// shop still holds (Paid − Returned) and what is still owed after it.
const salePaid = col("paid", "Paid", "បានបង់", "money", {
  total: true,
  value: (row) =>
    Math.max(0, Number(row.paid ?? 0) - Number(row.returned ?? 0)),
});
const saleBalance = col("balance", "Balance", "នៅខ្វះ", "money", {
  total: true,
  value: (row) =>
    Math.max(0, Number(row.grandTotal ?? 0) - Number(row.paid ?? 0)),
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
    periodFilter: { dateKey: "openedAt" },
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

  
    // Sales with a return are tinted pink, like open registers in Users.
    rowClassName: (row) => (Number(row.returned) > 0 ? "row-returned" : ""),
    // Footer breakdown: how many invoices have a return vs are simple.
    footerSummary: (rows) => {
      const returned = rows.filter((row) => Number(row.returned) > 0).length;
      return `Return: ${returned} | Simple: ${rows.length - returned}`;
    },

    // Admins / owners may delete any sale (gated by the Delete permission);
    // onDelete and the backend put the stock back and undo any linked returns.
    title: [
      "POS Sales (All Branches) (All Warehouses)",
      "ការលក់ POS (គ្រប់សាខា) (គ្រប់ឃ្លាំង)",
    ],
    noun: ["Sale", "ការលក់"],
    icon: "heart",
    addHref: "/pos",
    initialSort: sortByDate,
    periodFilter: { branchKey: "branch", dateKey: "date" },
    details,
    canEdit: false,
    onDelete: (row) => {
      // Deleting a sale puts back what is still out: the sold quantity minus
      // whatever a linked return already restocked. The backend does the same
      // and also removes the linked returns.
      const sale = row as Transaction;
      const returnedByProduct = new Map<string, number>();
      getRows("saleReturns")
        .filter((ret) => ret.referenceTo === sale.reference)
        .forEach((ret) =>
          ((ret as Transaction).items ?? []).forEach((line) =>
            returnedByProduct.set(
              line.productId,
              (returnedByProduct.get(line.productId) ?? 0) + line.quantity,
            ),
          ),
        );
      adjustStock(
        sale.items.map((line) => ({
          productId: line.productId,
          delta: Math.max(
            0,
            line.quantity - (returnedByProduct.get(line.productId) ?? 0),
          ),
          location: sale,
        })),
      );
    },
    // Click a sale to see its receipt and print it again (only when paid).
    onRowClick: (row) => printReceipt(row),
    // Same order as WeERP: details, payments, edit, return, delete.
    menuItems: (row, { navigate, l }) => [
      {
        icon: "print",
        label: l(["View / Print Receipt", "មើល / បោះពុម្ពវិក្កយបត្រ"]),
        onClick: () => printReceipt(row),
      },
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
      salePaid,
      col("discount", "Discount", "បញ្ចុះតម្លៃ", "money", { total: true }),
      saleBalance,
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
    periodFilter: { branchKey: "branch", dateKey: "date" },
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
    periodFilter: { branchKey: "branch", dateKey: "date" },
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
    menuItems: (row, { navigate, l, branch }) =>
      row.status === "pending"
        ? // A transfer (it has a destination branch) is accepted by the
          // RECEIVING branch, which then deducts the sending branch's stock and
          // takes it in, all in one step. The sending branch only waits (it can
          // still cancel by deleting), so it gets no Accept button. A plain
          // issue (no destination) is accepted by its own branch as before.
          !!row.toBranch && !!branch && row.branch === branch
          ? []
          : approvalItems(
              "stock-issue",
              row,
              l,
              // Any transfer (it has a destination) is completed in one step by
              // whoever accepts it here — the receiving branch or the owner.
              !!row.toBranch,
            )
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
              {
                icon: "alert",
                label: l(["Report short", "រាយការណ៍ខ្វះ"]),
                onClick: () =>
                  navigate(`/transfers?short=${encodeURIComponent(row.id)}`),
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
    periodFilter: { branchKey: "branch", dateKey: "date" },
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
    periodFilter: { branchKey: "branch", dateKey: "date" },
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
