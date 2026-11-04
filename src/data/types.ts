export type Row = { id: string } & Record<string, unknown>;

export type LineItem = {
  productId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  /** Unit cost for stock receive / issue, unit price for sales. Riel. */
  price: number;
  productDiscount?: {
    /** Percentage when true, riel when false. */
    percent: boolean;
    value: number;
  };
  expiry?: string;
  /** Quantity adjustments only. */
  type?: "addition" | "subtraction";
  /** Stock adjustments: why this line changed. */
  description?: string;
  /** Sale returns: false when the goods do not go back into stock (spoiled). */
  returnStock?: boolean;
};

/** One payment towards a sale (a sale can be paid in several parts). */
export type Payment = {
  id: string;
  date: string;
  reference: string;
  method: string;
  /** Riel. */
  amount: number;
  note?: string;
  createdBy: string;
};

export type Transaction = Row & {
  date: string;
  reference: string;
  referenceTo?: string;
  branch?: string;
  /** Stock issue: the branch the goods go to. */
  toBranch?: string;
  warehouse?: string;
  customer?: string;
  supplier?: string;
  items: LineItem[];
  total: number;
  orderTax: number;
  discount: number;
  generalDiscountPercent?: number;
  shipping: number;
  /** Sale returns: fee kept from the refund. */
  surcharge?: number;
  grandTotal: number;
  paid: number;
  returned: number;
  balance: number;
  paymentStatus: string;
  status: string;
  note?: string;
  createdBy: string;
  /** POS sales: how it was paid and the cashier register it belongs to. */
  paymentMethod?: string;
  registerId?: string;
  /** Sales: every payment; older sales only have `paid` + `paymentMethod`. */
  payments?: Payment[];
};
