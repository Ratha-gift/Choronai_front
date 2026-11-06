import type { CollectionName } from "@/data/collections";
import type { LineItem } from "@/data/types";
import type { IconName } from "@/components/icons";
import type { Label } from "@/i18n";

export type TransactionKind =
  "sale" | "sale-return" | "stock-receive" | "stock-issue" | "adjustment";

export type KindDef = {
  collection: CollectionName;
  listHref: string;
  title: Label;
  /** Title when editing a saved record (only kinds that can be edited). */
  editTitle?: Label;
  icon: IconName;
  prefixSetting: string;
  party?: "customer" | "supplier";
  /** Copy items from an existing record (returns). */
  source?: CollectionName;
  /** Stock direction when saved: +1 in, -1 out, 0 none. */
  stock: 1 | -1 | 0;
  /** Item price is the cost (stock receive / issue) or the selling price (sales). */
  price: "cost" | "price" | "none";
  expiry?: boolean;
  statuses: string[];
  /** true: the form has an Amount Paid box; "keep": payments are added separately and kept on edit. */
  payment?: boolean | "keep";
  /** Show order tax, discount and shipping (off for stock movements). */
  charges?: boolean;
  /** Goods leave for another branch: "From Branch" → "To Branch". */
  toBranch?: boolean;
};

export const KINDS: Record<TransactionKind, KindDef> = {
  // Only used to edit a POS sale; new sales are made in the POS.
  sale: {
    collection: "sales",
    listHref: "/sales/pos-sales",
    title: ["Edit Sale", "កែការលក់"],
    editTitle: ["Edit Sale", "កែការលក់"],
    icon: "heart",
    prefixSetting: "salePrefix",
    party: "customer",
    stock: -1,
    price: "price",
    statuses: ["completed"],
    payment: "keep",
  },
  "sale-return": {
    collection: "saleReturns",
    listHref: "/sales/returns",
    title: ["Return Sale", "លក់ត្រឡប់"],
    icon: "undo",
    prefixSetting: "returnSalePrefix",
    party: "customer",
    source: "sales",
    stock: 1,
    price: "price",
    statuses: ["completed"],
    payment: true,
  },
  "stock-receive": {
    collection: "stockReceives",
    listHref: "/inventory/stock-receive",
    title: ["Add Stock Receive", "បន្ថែមការទទួលស្តុក"],
    editTitle: ["Edit Stock Receive", "កែការទទួលស្តុក"],
    icon: "download",
    prefixSetting: "stockReceivePrefix",
    stock: 1,
    price: "cost",
    statuses: ["completed"],
    charges: false,
    expiry: true,
  },
  "stock-issue": {
    collection: "stockIssues",
    listHref: "/inventory/stock-issue",
    title: ["Add Stock Issue", "បន្ថែមការបញ្ចេញស្តុក"],
    editTitle: ["Edit Stock Issue", "កែការបញ្ចេញស្តុក"],
    icon: "upload",
    prefixSetting: "stockIssuePrefix",
    toBranch: true,
    stock: -1,
    price: "cost",
    // Stock leaves only once someone with "stock.approve" accepts it.
    statuses: ["pending", "accepted", "rejected"],
    charges: false,
  },
  adjustment: {
    collection: "adjustments",
    listHref: "/inventory/stock-adjustment",
    title: ["Add Stock Adjustment", "បន្ថែមការកែតម្រូវស្តុក"],
    editTitle: ["Edit Stock Adjustment", "កែការកែតម្រូវស្តុក"],
    icon: "filter",
    prefixSetting: "adjustmentPrefix",
    stock: 1,
    price: "none",
    expiry: true,
    // New adjustments are pending; Approve / Reject are in the list's actions.
    statuses: ["pending", "approved", "rejected"],
  },
};

/** Signed stock change of one line for a kind (adjustments use the line type). */
export const lineDelta = (kind: KindDef, line: LineItem) =>
  line.returnStock === false
    ? 0
    : kind.price === "none"
      ? line.type === "subtraction"
        ? -line.quantity
        : line.quantity
      : kind.stock * line.quantity;

/** Statuses that need the "stock.approve" permission. */
export const APPROVED_STATUSES = ["approved", "accepted", "rejected"];

/** Whether a record's status moves stock. */
export const statusMovesStock = (kind: TransactionKind, status: string) =>
  kind === "adjustment"
    ? status === "approved"
    : kind === "stock-issue"
      ? status === "accepted"
      : true;

/** An accepted transfer (or one sent before approvals existed) can be received. */
export const canReceiveTransfer = (row: object) =>
  !!(row as { toBranch?: unknown }).toBranch &&
  ["accepted", "dispatched", "partial"].includes(
    String((row as { status?: unknown }).status),
  );

/** Legacy saved records already moved stock, including old pending adjustments. */
export const appliedStock = (
  kind: TransactionKind,
  row: { status?: string; stockApplied?: unknown },
) =>
  typeof row.stockApplied === "boolean"
    ? row.stockApplied
    : kind !== "adjustment" ||
      row.status === "approved" ||
      row.status === "pending";
