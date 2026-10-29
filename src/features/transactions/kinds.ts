import type { CollectionName } from "@/data/collections";
import type { LineItem } from "@/data/types";
import type { IconName } from "@/components/icons";
import type { Label } from "@/i18n";

export type TransactionKind =
  | "purchase"
  | "purchase-request"
  | "purchase-order"
  | "purchase-return"
  | "sale-return"
  | "adjustment";

export type KindDef = {
  collection: CollectionName;
  listHref: string;
  title: Label;
  icon: IconName;
  prefixSetting: string;
  party?: "customer" | "supplier";
  /** Copy items from an existing record (returns). */
  source?: CollectionName;
  /** Stock direction when saved: +1 in, -1 out, 0 none. */
  stock: 1 | -1 | 0;
  /** Item price is the cost (purchases) or the selling price (sales). */
  price: "cost" | "price" | "none";
  expiry?: boolean;
  statuses: string[];
  payment?: boolean;
};

export const KINDS: Record<TransactionKind, KindDef> = {
  purchase: {
    collection: "purchases",
    listHref: "/purchases/list",
    title: ["Add Purchase", "បន្ថែមការទិញ"],
    icon: "star",
    prefixSetting: "purchasePrefix",
    party: "supplier",
    stock: 1,
    price: "cost",
    expiry: true,
    statuses: ["received", "pending", "ordered"],
    payment: true,
  },
  "purchase-request": {
    collection: "purchaseRequests",
    listHref: "/purchases/requests",
    title: ["Add Purchase Request", "បន្ថែមសំណើទិញ"],
    icon: "star",
    prefixSetting: "purchaseRequestPrefix",
    party: "supplier",
    stock: 0,
    price: "cost",
    statuses: ["pending", "approved", "rejected"],
  },
  "purchase-order": {
    collection: "purchaseOrders",
    listHref: "/purchases/orders",
    title: ["Add Purchase Order", "បន្ថែមបញ្ជាទិញ"],
    icon: "star",
    prefixSetting: "purchaseOrderPrefix",
    party: "supplier",
    stock: 0,
    price: "cost",
    statuses: ["pending", "approved", "completed"],
  },
  "purchase-return": {
    collection: "purchaseReturns",
    listHref: "/purchases/returns",
    title: ["Return Purchase", "ទិញត្រឡប់"],
    icon: "undo",
    prefixSetting: "returnPurchasePrefix",
    party: "supplier",
    source: "purchases",
    stock: -1,
    price: "cost",
    statuses: ["completed"],
    payment: true,
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
  adjustment: {
    collection: "adjustments",
    listHref: "/inventory/quantity-adjustments",
    title: ["Add Adjustment", "បន្ថែមការកែសម្រួល"],
    icon: "filter",
    prefixSetting: "adjustmentPrefix",
    stock: 1,
    price: "none",
    statuses: ["approved", "pending"],
  },
};

/** Signed stock change of one line for a kind (adjustments use the line type). */
export const lineDelta = (kind: KindDef, line: LineItem) =>
  kind.price === "none"
    ? line.type === "subtraction"
      ? -line.quantity
      : line.quantity
    : kind.stock * line.quantity;
