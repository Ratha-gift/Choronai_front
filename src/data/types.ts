export type Row = { id: string } & Record<string, unknown>;

export type LineItem = {
  productId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  /** Unit cost for stock receive / issue, unit price for sales. Riel. */
  price: number;
  expiry?: string;
  /** Quantity adjustments only. */
  type?: "addition" | "subtraction";
  /** Stock adjustments: why this line changed. */
  description?: string;
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
  shipping: number;
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
};
